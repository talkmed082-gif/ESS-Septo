import "server-only";
import { prisma } from "@/lib/prisma";
import {
  carryOverSoap,
  mergeOutpatientSoap,
  type OutpatientRow,
  type OutpatientSoapItem,
  type PcJobKey,
  type TsaRunBody,
} from "@/lib/hospital-link";

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

// 명단(saveOutpatientList)이 먼저 올라와 있어야 한다(없으면 null).
export async function saveOutpatientSoap(userId: string, body: { date: string; items: OutpatientSoapItem[] }) {
  const list = await prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: userId, date: body.date } } });
  if (!list) return null;
  const { rows, matched } = mergeOutpatientSoap(list.rows as OutpatientRow[], body.items);
  await prisma.outpatientList.update({ where: { id: list.id }, data: { rows } });
  return { ok: true, matched };
}
