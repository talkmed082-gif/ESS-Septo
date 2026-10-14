import "server-only";
import { prisma } from "@/lib/prisma";
import type { OutpatientRow, TsaRunBody } from "@/lib/hospital-link";

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

export async function saveOutpatientList(
  userId: string,
  body: { date: string; clinic: string; rows: OutpatientRow[] },
) {
  await prisma.outpatientList.upsert({
    where: { createdById_date: { createdById: userId, date: body.date } },
    create: { date: body.date, clinic: body.clinic, rows: body.rows, createdById: userId },
    update: { clinic: body.clinic, rows: body.rows },
  });
  return { ok: true, count: body.rows.length };
}
