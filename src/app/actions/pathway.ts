"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { SetStageSchema } from "@/lib/pathways";
import { removePatientPathway, setPatientStage } from "@/lib/pathway-store";

// 진료 경로 단계 확정·변경(갈림길 선택, AI 제안 받기 포함) — 본인 것만
export async function setStage(chartNo: string, pathwayId: string, stageId: string): Promise<void> {
  const session = await verifySession();
  const parsed = SetStageSchema.safeParse({ chartNo, pathwayId, stageId });
  if (!parsed.success) return;
  await setPatientStage(session.userId, parsed.data.chartNo, parsed.data.pathwayId, parsed.data.stageId);
  revalidatePath("/outpatient");
  revalidatePath("/clinic");
}

export async function removePathway(chartNo: string, pathwayId: string): Promise<void> {
  const session = await verifySession();
  if (!/^\d{4,12}$/.test(chartNo)) return;
  await removePatientPathway(session.userId, chartNo, pathwayId);
  revalidatePath("/outpatient");
  revalidatePath("/clinic");
}
