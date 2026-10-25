"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ClinicJobSchema } from "@/lib/opd-jobs";

// 웹 진료 화면 [보내기] — 노트북(환자 선택·새 기록지부터 혼자 처리) 또는 진료실 PC(그 환자 기록지가 EMR에 열려 있을 때 처리).
// 같은 날 같은 환자는 새로 덮어써 다시 대기(보낼 곳도 바뀜). 본인 것만
export async function sendToClinic(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await verifySession();
  const parsed = ClinicJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "형식이 올바르지 않습니다." };
  const d = parsed.data;
  if (!d.note && !d.dx && !d.scope) return { ok: false, error: "할 일을 하나 이상 고르세요." };
  if (d.templateId) {
    const t = await prisma.outpatientTemplate.findFirst({ where: { id: d.templateId, createdById: userId }, select: { id: true } });
    if (!t) return { ok: false, error: "템플릿을 찾지 못했습니다." };
  }
  const data = {
    name: d.name,
    visit: d.visit,
    templateId: d.templateId,
    tasks: { note: d.note, dx: d.dx, scope: d.scope, where: d.where },
    practice: d.practice,
    status: "pending",
    result: null,
    tries: 0,
  };
  await prisma.opdJob.upsert({
    where: { createdById_visitDate_chartNo: { createdById: userId, visitDate: d.visitDate, chartNo: d.chartNo } },
    create: { ...data, visitDate: d.visitDate, chartNo: d.chartNo, createdById: userId },
    update: data,
  });
  revalidatePath("/clinic");
  return { ok: true };
}

// 아직 처리 전(대기·나중에 다시)인 것만 취소
export async function cancelClinicJob(id: string): Promise<void> {
  const { userId } = await verifySession();
  if (typeof id !== "string" || id.length > 40) return;
  await prisma.opdJob.updateMany({ where: { id, createdById: userId, status: { in: ["pending", "waiting"] } }, data: { status: "cancelled", result: "취소함" } });
  revalidatePath("/clinic");
}
