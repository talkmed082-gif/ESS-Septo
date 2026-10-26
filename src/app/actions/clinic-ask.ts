"use server";

import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ClinicAskSchema, askState } from "@/lib/clinic-ask";

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
