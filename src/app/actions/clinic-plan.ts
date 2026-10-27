"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { CpapSchema } from "@/lib/cpap";
import { canRequestCheck, parseNoteState } from "@/lib/note-cleanup";

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

// 외래 후 서명 전 기록지 목록 — 직접 서명했거나 EMR에서 직접 지운 뒤 표시
export async function setNoteState(jobId: string, state: "signed" | "deleted" | null): Promise<void> {
  const { userId } = await verifySession();
  if (typeof jobId !== "string" || jobId.length > 40 || !(state === null || state === "signed" || state === "deleted")) return;
  await prisma.opdJob.updateMany({ where: { id: jobId, createdById: userId }, data: { noteState: state } });
  revalidatePath("/cpap");
}

// [EMR에서 확인] — 그날 노트북이 저장한 서명 전 기록지를 노트북이 다시 읽어 서명됨·안 온 환자 후보·직접 확인으로 나눈다(note-cleanup.ts)
export async function requestNoteCheck(date: string): Promise<void> {
  const { userId } = await verifySession();
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const jobs = await prisma.opdJob.findMany({ where: { createdById: userId, visitDate: date, status: "done", result: { contains: "기록지 저장됨" } }, select: { id: true, noteState: true } });
  const ids = jobs.filter((j) => canRequestCheck(j.noteState)).map((j) => j.id);
  if (ids.length) await prisma.opdJob.updateMany({ where: { id: { in: ids }, createdById: userId }, data: { noteState: "check" } });
  revalidatePath("/cpap");
}

// [삭제 승인] — 고른 후보(noShow)만 삭제 승인으로. 노트북이 지우기 직전에 세 조건을 다시 확인한다(사유 099 기타 "미내원(내원 전 미리 작성)")
export async function approveNoteDeletes(jobIds: string[]): Promise<void> {
  const { userId } = await verifySession();
  if (!Array.isArray(jobIds) || jobIds.length > 100 || jobIds.some((id) => typeof id !== "string" || id.length > 40)) return;
  const jobs = await prisma.opdJob.findMany({ where: { id: { in: jobIds }, createdById: userId }, select: { id: true, noteState: true } });
  for (const j of jobs) {
    const s = parseNoteState(j.noteState);
    if (s.kind !== "noShow") continue;
    await prisma.opdJob.updateMany({ where: { id: j.id, createdById: userId, noteState: j.noteState }, data: { noteState: `deleteRequested:${s.noteId}` } });
  }
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
