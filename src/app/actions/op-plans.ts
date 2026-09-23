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

  // 계획을 만든 뒤에도 수술 종류를 바꿀 수 있게 한다 — 화면(SurgeryPlanner)에서
  // 종류를 바꾸면 그 종류의 필드로 폼이 다시 그려지므로, formData도 이미 새
  // 종류에 맞는 값들로 채워져 있다. 기존 planData 중 새 종류에 없는 키는
  // 그냥 무시되고, 겹치는 키(비강 소견 등)는 그대로 유지된다.
  const requestedTypeId = formData.get("surgeryTypeId");
  let surgeryType = plan.surgeryType;
  if (typeof requestedTypeId === "string" && requestedTypeId && requestedTypeId !== plan.surgeryTypeId) {
    const newType = await prisma.surgeryType.findUnique({ where: { id: requestedTypeId } });
    if (!newType) {
      return { message: "수술 종류를 다시 선택하세요." };
    }
    surgeryType = newType;
  }

  const fields = parseFieldDefs(surgeryType.fields);
  const planData = fieldValuesFromFormData(formData, fields);

  await prisma.opPlan.update({
    where: { id: planId },
    data: {
      surgeryTypeId: surgeryType.id,
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      planNote: planNote || null,
      planData,
    },
  });

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/patients/${plan.patientId}`);
  // 이 화면(계획 작성) 자체가 환자 기본 화면이라, 저장 후 그대로 이 화면에
  // 남는다.
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
