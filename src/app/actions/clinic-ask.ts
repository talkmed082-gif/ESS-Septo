"use server";

import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ClinicAskSchema, askState, normChart } from "@/lib/clinic-ask";

// 폰 진료 화면 [Claude에게 묻기] — 질문을 남기고(노트북이 가져가 답함) 답을 묻는다. 본인 것만
export async function askClinicClaude(input: { visitDate: string; chartNo: string; question: string }): Promise<{ id: string } | { error: string }> {
  const { userId } = await verifySession();
  const parsed = ClinicAskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "형식이 올바르지 않습니다." };
  const a = await prisma.clinicAsk.create({ data: { ...parsed.data, createdById: userId }, select: { id: true } });
  return { id: a.id };
}

export async function getClinicAsk(id: string): Promise<{ state: ReturnType<typeof askState>; answer: string | null } | null> {
  const { userId } = await verifySession();
  const a = await prisma.clinicAsk.findFirst({ where: { id, createdById: userId }, select: { status: true, answer: true, createdAt: true, answeredAt: true } });
  return a ? { state: askState(a, new Date()), answer: a.answer } : null;
}

// 진료 브리핑에서 진료 완료 표시를 직접 바꾼다(done: true 완료, false 진료 전으로, null 자동으로 되돌림)
export async function setVisitDone(visitDate: string, chartNo: string, done: boolean | null): Promise<void> {
  const { userId } = await verifySession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !/^\d{3,12}$/.test(normChart(chartNo))) return;
  const key = { createdById: userId, visitDate, chartNo: normChart(chartNo) };
  await prisma.clinicMark.upsert({ where: { createdById_visitDate_chartNo: key }, create: { ...key, done }, update: { done } });
}
