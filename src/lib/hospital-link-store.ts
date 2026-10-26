import "server-only";
import { prisma } from "@/lib/prisma";
import {
  carryOverSoap,
  consultKey,
  consultNoteId,
  mergeOutpatientSoap,
  type ConsultItem,
  type OutpatientRow,
  type OutpatientSoapItem,
  type PcJobKey,
  type TsaRunBody,
} from "@/lib/hospital-link";
import { addRoadmapVersion } from "@/lib/roadmap-store";

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
  body: { date: string; clinic: string; rows: OutpatientRow[] },
) {
  // 같은 날짜를 다시 올리면(매일 아침 새로 고침) 붙어 있던 SOAP는 등록번호로 유지한다
  const existing = await prisma.outpatientList.findUnique({
    where: { createdById_date: { createdById: userId, date: body.date } },
    select: { rows: true },
  });
  const rows = existing ? carryOverSoap(existing.rows as OutpatientRow[], body.rows) : body.rows;
  await prisma.outpatientList.upsert({
    where: { createdById_date: { createdById: userId, date: body.date } },
    create: { date: body.date, clinic: body.clinic, rows, createdById: userId },
    update: { clinic: body.clinic, rows },
  });
  return { ok: true, count: body.rows.length };
}

// 병원 PC가 10분마다 확인하는 "타과의뢰 가져오기" 요청 시각(없으면 null)과 EMR에 저장할 회신(요청 순)
export async function getConsultRequest(userId: string) {
  const [user, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { consultCheckRequestedAt: true } }),
    prisma.consult.findMany({
      where: { createdById: userId, replyStatus: "PENDING", replied: false },
      orderBy: { replyRequestedAt: "asc" },
      select: { id: true, chartNo: true, emrKey: true, replyText: true, replyRequestedAt: true },
    }),
  ]);
  return {
    requestedAt: user?.consultCheckRequestedAt?.toISOString() ?? null,
    replies: pending
      .filter((c) => c.replyText && c.replyRequestedAt)
      .map((c) => ({
        id: c.id,
        chartNo: c.chartNo,
        noteId: consultNoteId(c),
        text: c.replyText!,
        requestedAt: c.replyRequestedAt!.toISOString(),
      })),
  };
}

// 회신 저장 결과 — 처리한 요청이 그대로일 때만 반영(그 사이 다시 요청·취소했으면 무시)
export async function recordConsultReply(
  userId: string,
  body: { id: string; requestedAt: string; ok: boolean; message?: string },
) {
  const r = await prisma.consult.updateMany({
    where: { id: body.id, createdById: userId, replyStatus: "PENDING", replyRequestedAt: new Date(body.requestedAt) },
    data: {
      replyStatus: body.ok ? "SAVED" : "FAILED",
      replyMessage: body.message ?? null,
      ...(body.ok ? { replySavedAt: new Date() } : {}),
    },
  });
  return { ok: true, updated: r.count };
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
