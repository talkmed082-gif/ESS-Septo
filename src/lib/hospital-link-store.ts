import "server-only";
import { prisma } from "@/lib/prisma";
import {
  carryOverSoap,
  consultKey,
  consultNoteId,
  consultReplyUpdate,
  mergeOutpatientSoap,
  type ConsultItem,
  type ConsultReplyResult,
  type OutpatientRow,
  type OutpatientSoapItem,
  type PcJobKey,
  type TsaRunBody,
} from "@/lib/hospital-link";
import { addRoadmapVersion } from "@/lib/roadmap-store";
import { classifyConsultField } from "@/lib/consult-field";

// 병원 PC가 10분마다 확인하는 "TSA 기간 확인" 요청(없으면 null)
export async function getTsaScanRequest(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tsaScanFrom: true, tsaScanTo: true, tsaScanRequestedAt: true },
  });
  if (!user?.tsaScanRequestedAt || !user.tsaScanFrom || !user.tsaScanTo) return null;
  return { from: user.tsaScanFrom, to: user.tsaScanTo, requestedAt: user.tsaScanRequestedAt.toISOString() };
}

// 실행 결과를 남기고, 처리한 요청이 그대로면(처리 중에 다시 누르지 않았으면) 요청을 비운다.
export async function recordTsaRun(userId: string, body: TsaRunBody) {
  await prisma.tsaRun.create({
    data: {
      kind: body.kind,
      rangeFrom: body.from,
      rangeTo: body.to,
      found: body.found,
      added: body.added,
      skipped: body.skipped,
      held: body.held,
      dups: body.dups,
      error: body.error ?? null,
      createdById: userId,
    },
  });
  if (body.requestedAt) {
    await prisma.user.updateMany({
      where: { id: userId, tsaScanRequestedAt: new Date(body.requestedAt) },
      data: { tsaScanFrom: null, tsaScanTo: null, tsaScanRequestedAt: null },
    });
  }
  return { ok: true };
}

// 병원 PC 작업 결과 — 작업마다 한 줄을 덮어쓰고, 실패면 마지막 실패도 따로 남긴다
export async function recordPcJob(userId: string, body: { job: PcJobKey; ok: boolean; message?: string }) {
  const now = new Date();
  const failure = body.ok ? {} : { lastFailureAt: now, lastFailure: body.message ?? null };
  await prisma.pcJobStatus.upsert({
    where: { createdById_job: { createdById: userId, job: body.job } },
    create: { job: body.job, lastRunAt: now, lastOk: body.ok, lastMessage: body.message ?? null, createdById: userId, ...failure },
    update: { lastRunAt: now, lastOk: body.ok, lastMessage: body.message ?? null, ...failure },
  });
  return { ok: true };
}

export async function saveOutpatientList(
  userId: string,
  body: { date: string; clinic: string; rows: OutpatientRow[]; merge?: boolean },
) {
  // 같은 날짜를 다시 올리면(매일 아침 새로 고침) 붙어 있던 SOAP는 등록번호로 유지한다
  const existing = await prisma.outpatientList.findUnique({
    where: { createdById_date: { createdById: userId, date: body.date } },
    select: { rows: true },
  });
  let rows = existing ? carryOverSoap(existing.rows as OutpatientRow[], body.rows) : body.rows;
  // merge(진료 화면 [새로고침]): 예전 명단에만 있는 환자(진료를 마쳐 EMR 명단에서 빠진 환자)도 남기고 시간순으로
  if (existing && body.merge) {
    const now = new Set(rows.map((r) => r.chartNo));
    rows = [...rows, ...(existing.rows as OutpatientRow[]).filter((r) => !now.has(r.chartNo))].sort((a, b) => a.time.localeCompare(b.time));
  }
  await prisma.outpatientList.upsert({
    where: { createdById_date: { createdById: userId, date: body.date } },
    create: { date: body.date, clinic: body.clinic, rows, createdById: userId },
    update: { clinic: body.clinic, rows },
  });
  return { ok: true, count: rows.length };
}

// 병원 PC가 10분마다 확인하는 것: "타과의뢰 가져오기" 요청 시각(없으면 null), EMR에 저장·서명할 회신(replies, 요청 순),
// 저장은 됐는데 서명 못 한 회신(signs — 인증서 비밀번호를 넣은 뒤 서명만 다시)
export async function getConsultRequest(userId: string) {
  const [user, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { consultCheckRequestedAt: true } }),
    prisma.consult.findMany({
      where: { createdById: userId, replyStatus: { in: ["PENDING", "SAVED"] }, replied: false },
      orderBy: { replyRequestedAt: "asc" },
      select: {
        id: true,
        chartNo: true,
        emrKey: true,
        replyText: true,
        replyRequestedAt: true,
        replyStatus: true,
        replyDoctorNoteId: true,
      },
    }),
  ]);
  const live = rows.filter((c) => c.replyRequestedAt);
  return {
    requestedAt: user?.consultCheckRequestedAt?.toISOString() ?? null,
    replies: live
      .filter((c) => c.replyStatus === "PENDING" && c.replyText)
      .map((c) => ({
        id: c.id,
        chartNo: c.chartNo,
        noteId: consultNoteId(c),
        text: c.replyText!,
        requestedAt: c.replyRequestedAt!.toISOString(),
      })),
    signs: live
      .filter((c) => c.replyStatus === "SAVED" && c.replyDoctorNoteId)
      .map((c) => ({
        id: c.id,
        chartNo: c.chartNo,
        doctorNoteId: c.replyDoctorNoteId!,
        requestedAt: c.replyRequestedAt!.toISOString(),
      })),
  };
}

// 회신 저장·서명 결과 — 처리한 요청이 그대로일 때만 반영(그 사이 다시 요청·취소했으면 무시). 처음 저장된 시각은 남긴다
export async function recordConsultReply(userId: string, body: ConsultReplyResult) {
  const row = await prisma.consult.findFirst({
    where: {
      id: body.id,
      createdById: userId,
      replyStatus: { in: ["PENDING", "SAVED"] },
      replyRequestedAt: new Date(body.requestedAt),
    },
    select: { id: true, replySavedAt: true, replyStatus: true },
  });
  if (!row) return { ok: true, updated: 0 };
  const now = new Date();
  await prisma.consult.update({
    where: { id: row.id },
    data: {
      ...consultReplyUpdate(body, now),
      ...(body.ok && row.replyStatus === "PENDING" ? { replySavedAt: now } : {}),
    },
  });
  return { ok: true, updated: 1 };
}

// EMR 타과의뢰 목록을 반영한다. 올린 기간(의뢰일 from~to) 안인데 이번 목록에 없는 것은 EMR에서 취소된 것으로 보고 지운다.
// 처리한 요청이 그대로면(처리 중에 다시 누르지 않았으면) 요청을 비운다. error가 있으면 목록은 그대로 두고 요청만 비운다.
export async function saveConsults(
  userId: string,
  body: { from: string; to: string; items: ConsultItem[]; requestedAt?: string; error?: string },
) {
  const keys = body.items.map(consultKey);
  if (!body.error) await prisma.$transaction([
    prisma.consult.deleteMany({
      where: { createdById: userId, requestedAt: { gte: body.from, lte: `${body.to} 99` }, emrKey: { notIn: keys } },
    }),
    ...body.items.map((i) => {
      const { noteId, ...data } = i;
      const emrKey = consultKey({ chartNo: i.chartNo, noteId });
      return prisma.consult.upsert({
        where: { createdById_emrKey: { createdById: userId, emrKey } },
        create: { ...data, emrKey, createdById: userId },
        update: data,
      });
    }),
  ]);
  // 아직 판정 안 한 의뢰만 내 분야인지 판정(한 의뢰에 한 번 — 규칙으로 안 되면 Jev 1번). 회신 끝난 지난 의뢰도(사용자 2026-10-26 "이전 것도")
  if (!body.error) {
    const todo = await prisma.consult.findMany({
      where: { createdById: userId, field: null, emrKey: { in: keys } },
      select: { id: true, content: true, diagnosis: true },
    });
    for (const c of todo) {
      const r = await classifyConsultField(c);
      await prisma.consult.update({ where: { id: c.id }, data: { field: r.field, fieldReason: r.reason } });
    }
  }
  if (body.requestedAt) {
    await prisma.user.updateMany({
      where: { id: userId, consultCheckRequestedAt: new Date(body.requestedAt) },
      data: { consultCheckRequestedAt: null },
    });
  }
  return { ok: true, count: body.items.length };
}

// 명단(saveOutpatientList)이 먼저 올라와 있어야 한다(없으면 null).
export async function saveOutpatientSoap(userId: string, body: { date: string; items: OutpatientSoapItem[] }) {
  const list = await prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: userId, date: body.date } } });
  if (!list) return null;
  const { rows, matched } = mergeOutpatientSoap(list.rows as OutpatientRow[], body.items);
  await prisma.outpatientList.update({ where: { id: list.id }, data: { rows } });
  // 외래 전날 만든 로드맵도 환자별 로드맵 이력에 쌓는다(명단에 있는 환자만)
  const inList = new Set(rows.map((r) => r.chartNo));
  for (const i of body.items) if (i.roadmap && inList.has(i.chartNo)) await addRoadmapVersion(userId, i.chartNo, i.roadmap, "soap");
  return { ok: true, matched };
}
