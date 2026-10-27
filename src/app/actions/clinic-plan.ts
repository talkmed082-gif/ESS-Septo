"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { CpapSchema } from "@/lib/cpap";

// 외래 진행 중 Plan(사용자 2026-10-27) — 수술·CPAP을 고르면 외래 후에 모인다. PatientCare.planType
const PLAN = z.enum(["surgery", "cpap", "medication", "observation", "return"]);
export async function setCarePlan(chartNo: string, plan: string | null): Promise<void> {
  const { userId } = await verifySession();
  if (!/^\d{4,12}$/.test(chartNo)) return;
  const p = plan === null ? null : PLAN.safeParse(plan);
  if (p && !p.success) return;
  const planType = p ? p.data : null;
  await prisma.patientCare.upsert({
    where: { createdById_chartNo: { createdById: userId, chartNo } },
    create: { createdById: userId, chartNo, planType },
    update: { planType },
  });
  revalidatePath("/clinic");
  revalidatePath("/cpap");
}

// 외래 후 서명 전 기록지 목록 — 직접 서명했거나 EMR에서 지운 뒤 표시(사이트는 EMR 기록지를 지우지 않는다: 되돌릴 수 없는 삭제라 사용자가 직접)
export async function setNoteState(jobId: string, state: "signed" | "deleted" | null): Promise<void> {
  const { userId } = await verifySession();
  if (typeof jobId !== "string" || jobId.length > 40 || !(state === null || state === "signed" || state === "deleted")) return;
  await prisma.opdJob.updateMany({ where: { id: jobId, createdById: userId }, data: { noteState: state } });
  revalidatePath("/cpap");
}

// 외래 후 [처방 안내 문자]를 누르면 — 이번 외래에서 낸 처방으로 다음 F/U를 다시 잡고(처방일 = 그 외래 날짜, 개월), 압력을 바꿨으면 설정도,
// 보낸 기록을 남긴다(사용자 2026-10-27 "오늘 보낸 환자는 오늘부터 다시 3개월 미래로", "문자 보냈는지 남기기")
const Notice = z.object({ chartNo: z.string().regex(/^\d{4,12}$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), months: z.number().int().min(1).max(24), pressure: z.string().max(20).nullable(), text: z.string().max(300) });
export async function recordCpapNotice(input: unknown): Promise<void> {
  const { userId } = await verifySession();
  const n = Notice.safeParse(input);
  if (!n.success) return;
  const care = await prisma.patientCare.findUnique({ where: { createdById_chartNo: { createdById: userId, chartNo: n.data.chartNo } }, select: { cpap: true } });
  const c = CpapSchema.safeParse(care?.cpap ?? {});
  if (!c.success) return;
  const cpap = {
    ...c.data,
    rxDate: n.data.date,
    months: n.data.months,
    rxLine: n.data.text,
    setting: n.data.pressure ? `Pr ${n.data.pressure}` : c.data.setting,
    notice: { at: new Date().toISOString(), date: n.data.date, text: n.data.text },
  };
  await prisma.patientCare.update({ where: { createdById_chartNo: { createdById: userId, chartNo: n.data.chartNo } }, data: { cpap } });
  revalidatePath("/cpap");
  revalidatePath("/outpatient");
}
