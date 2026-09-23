"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldValues, fieldValuesFromFormData, type FieldValues } from "@/lib/field-types";
import { isNasalFindingKey, REVISION_FLAG_KEYS, resolveSurgeryTypeFields } from "@/lib/op-note-defs";

const OpPlanSchema = z.object({
  plannedDate: z.string().trim().optional(),
  planNote: z.string().trim().optional(),
  saveIntent: z.enum(["save", "record"]).optional(),
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
    saveIntent: formData.get("saveIntent") || undefined,
  });
  if (!validated.success) {
    return { message: "입력값을 확인하세요." };
  }
  const { plannedDate, planNote, saveIntent } = validated.data;

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

  const fields = resolveSurgeryTypeFields(surgeryType);
  const submittedValues = fieldValuesFromFormData(formData, fields);

  // 완료(DONE) 처리된 계획은 Op Plan 표가 계속 원래 계획 그대로를 보여줘야
  // 하므로, 이후 저장부터는 planData의 절차(수술 방법) 항목을 더 이상
  // 덮어쓰지 않는다 — 비강 소견만 최신화하고, 수술 방법 쪽 수정은
  // actualData에만 반영해 기록지 초안에만 영향을 주게 한다.
  let planData: FieldValues = submittedValues;
  let actualData: FieldValues | undefined;
  if (plan.status === "DONE") {
    const existingPlanValues = parseFieldValues(plan.planData);
    const existingActualValues = parseFieldValues(plan.actualData);
    const nasalPart: FieldValues = {};
    const procedurePart: FieldValues = {};
    for (const f of fields) {
      if (isNasalFindingKey(f.key) || (REVISION_FLAG_KEYS as readonly string[]).includes(f.key)) {
        nasalPart[f.key] = submittedValues[f.key];
      } else {
        procedurePart[f.key] = submittedValues[f.key];
      }
    }
    planData = { ...existingPlanValues, ...nasalPart };
    actualData = { ...existingActualValues, ...procedurePart };
  }

  await prisma.opPlan.update({
    where: { id: planId },
    data: {
      surgeryTypeId: surgeryType.id,
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      planNote: planNote || null,
      planData,
      ...(actualData !== undefined ? { actualData } : {}),
    },
  });

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/patients/${plan.patientId}`);
  // 이 화면(계획 작성) 자체가 환자 기본 화면이라, 저장 후 그대로 이 화면에
  // 남는다. "저장 후 기록지 작성" 버튼으로 저장했으면 수술 후 기본화면
  // (수술 방법·기록지)이 바로 열리게 view를 지정해서 넘긴다.
  redirect(`/plans/${planId}${saveIntent === "record" ? "?view=post" : ""}`);
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
