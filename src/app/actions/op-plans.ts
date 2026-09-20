"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, fieldValuesFromFormData } from "@/lib/field-types";

const OpPlanSchema = z.object({
  plannedDate: z.string().trim().optional(),
  planNote: z.string().trim().optional(),
});

export interface OpPlanFormState {
  message?: string;
}

export async function updateOpPlan(
  planId: string,
  _prevState: OpPlanFormState | undefined,
  formData: FormData,
): Promise<OpPlanFormState> {
  await verifySession();

  const plan = await prisma.opPlan.findUnique({
    where: { id: planId },
    include: { surgeryType: true },
  });
  if (!plan) {
    return { message: "수술 계획을 찾을 수 없습니다." };
  }

  const validated = OpPlanSchema.safeParse({
    plannedDate: formData.get("plannedDate"),
    planNote: formData.get("planNote"),
  });
  if (!validated.success) {
    return { message: "입력값을 확인하세요." };
  }
  const { plannedDate, planNote } = validated.data;

  const fields = parseFieldDefs(plan.surgeryType.fields);
  const planData = fieldValuesFromFormData(formData, fields);

  await prisma.opPlan.update({
    where: { id: planId },
    data: {
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      planNote: planNote || null,
      planData,
    },
  });

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/patients/${plan.patientId}`);
  redirect(`/plans/${planId}`);
}


export async function deleteOpPlan(planId: string, patientId: string) {
  await verifySession();
  await prisma.opPlan.delete({ where: { id: planId } });
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

// 기록지를 아직 안 썼어도(수술 당일이 아니라 며칠 뒤에 쓰는 경우가 많아서)
// 환자 목록의 "예정)" 표시를 수술 완료 시점에 바로 지울 수 있게 하는
// 수동 토글. OpPlan.status 컬럼은 있었지만 그동안 아무 데서도 안 쓰였음.
export async function toggleOpPlanDone(planId: string) {
  await verifySession();
  const plan = await prisma.opPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  await prisma.opPlan.update({
    where: { id: planId },
    data: { status: plan.status === "DONE" ? "PLANNED" : "DONE" },
  });
  revalidatePath("/patients");
}
