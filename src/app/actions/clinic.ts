"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ClinicDefaultsSchema, ClinicJobSchema, OpdJobSubmitSchema } from "@/lib/opd-jobs";
import { kstDate } from "@/lib/hospital-link";

// 웹 진료 화면 [보내기] — 노트북(환자 선택·새 기록지부터 혼자 처리) 또는 진료실 PC(그 환자 기록지가 EMR에 열려 있을 때 처리).
// 같은 날 같은 환자는 새로 덮어써 다시 대기(보낼 곳도 바뀜). 본인 것만
export async function sendToClinic(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await verifySession();
  const parsed = ClinicJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "형식이 올바르지 않습니다." };
  const d = parsed.data;
  if (!d.note && !d.dx && !d.scope) return { ok: false, error: "할 일을 하나 이상 고르세요." };
  // 오늘과 앞날만(전날 밤에 다음 날 하루치를 보내 두면 노트북이 07:30부터 처리)
  if (d.visitDate < kstDate(new Date())) return { ok: false, error: "지난 외래는 보낼 수 없습니다." };
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

// 하루치를 노트북으로 한 번에 — 고른 환자만, 보낼 곳은 노트북으로 고정. 같은 날 같은 환자는 덮어써 다시 대기
export async function sendBatchToLaptop(input: unknown): Promise<{ ok: boolean; count?: number; error?: string }> {
  const { userId } = await verifySession();
  const parsed = OpdJobSubmitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "형식이 올바르지 않습니다." };
  const { visitDate, practice, items } = parsed.data;
  if (visitDate < kstDate(new Date())) return { ok: false, error: "지난 외래는 보낼 수 없습니다." };
  const ids = [...new Set(items.map((i) => i.templateId).filter((x): x is string => !!x))];
  if (ids.length && (await prisma.outpatientTemplate.count({ where: { id: { in: ids }, createdById: userId } })) !== ids.length) return { ok: false, error: "템플릿을 찾지 못했습니다." };
  await prisma.$transaction(
    items.map((it) => {
      const data = { name: it.name, visit: it.visit, templateId: it.templateId, tasks: { ...it.tasks, where: "laptop" }, practice, status: "pending", result: null, tries: 0 };
      return prisma.opdJob.upsert({
        where: { createdById_visitDate_chartNo: { createdById: userId, visitDate, chartNo: it.chartNo } },
        create: { ...data, visitDate, chartNo: it.chartNo, createdById: userId },
        update: data,
      });
    }),
  );
  revalidatePath("/clinic");
  return { ok: true, count: items.length };
}

// [이 설정 저장] — 보낼 곳·할 일 선택을 계정 기본값으로(어느 기기에서 열어도 같음)
export async function saveClinicDefaults(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await verifySession();
  const parsed = ClinicDefaultsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "형식이 올바르지 않습니다." };
  await prisma.user.update({ where: { id: userId }, data: { clinicSendDefaults: parsed.data } });
  revalidatePath("/clinic");
  return { ok: true };
}

// 명단 [새로고침] — 사이트 상태는 화면이 바로 다시 읽고, EMR 명단은 노트북 작업자에게 요청(다음 묻기 때 가져감, 2026-10-27)
export async function requestOutpatientRefresh(date: unknown): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await verifySession();
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
  if (date < kstDate(new Date())) return { ok: false, error: "지난 날짜는 EMR 명단을 다시 읽지 않습니다." };
  await prisma.user.update({ where: { id: userId }, data: { outpatientRefreshDate: date, outpatientRefreshAt: new Date() } });
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
