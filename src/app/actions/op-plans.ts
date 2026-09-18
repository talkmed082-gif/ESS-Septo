"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, fieldValuesFromFormData } from "@/lib/field-types";

const OpPlanSchema = z.object({
  surgeryTypeId: z.string().trim().min(1),
  plannedDate: z.string().trim().optional(),
  side: z.enum(["Rt.", "Lt.", "Both", ""]).optional(),
  diagnosis: z.string().trim().optional(),
  planNote: z.string().trim().optional(),
});

export interface OpPlanFormState {
  message?: string;
}

export async function createOpPlan(
  patientId: string,
  _prevState: OpPlanFormState | undefined,
  formData: FormData,
): Promise<OpPlanFormState> {
  const session = await verifySession();

  const validated = OpPlanSchema.safeParse({
    surgeryTypeId: formData.get("surgeryTypeId"),
    plannedDate: formData.get("plannedDate"),
    side: formData.get("side"),
    diagnosis: formData.get("diagnosis"),
    planNote: formData.get("planNote"),
  });
  if (!validated.success) {
    return { message: "입력값을 확인하세요." };
  }
  const { surgeryTypeId, plannedDate, side, diagnosis, planNote } =
    validated.data;

  const surgeryType = await prisma.surgeryType.findUnique({
    where: { id: surgeryTypeId },
  });
  if (!surgeryType) {
    return { message: "수술 종류를 선택하세요." };
  }
  const fields = parseFieldDefs(surgeryType.fields);
  const planData = fieldValuesFromFormData(formData, fields);

  const plan = await prisma.opPlan.create({
    data: {
      patientId,
      surgeryTypeId,
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      side: side || null,
      diagnosis: diagnosis || null,
      planNote: planNote || null,
      planData,
      createdById: session.userId,
    },
  });

  revalidatePath(`/patients/${patientId}`);
  redirect(`/plans/${plan.id}`);
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

  const validated = OpPlanSchema.omit({ surgeryTypeId: true }).safeParse({
    plannedDate: formData.get("plannedDate"),
    side: formData.get("side"),
    diagnosis: formData.get("diagnosis"),
    planNote: formData.get("planNote"),
  });
  if (!validated.success) {
    return { message: "입력값을 확인하세요." };
  }
  const { plannedDate, side, diagnosis, planNote } = validated.data;

  const fields = parseFieldDefs(plan.surgeryType.fields);
  const planData = fieldValuesFromFormData(formData, fields);

  await prisma.opPlan.update({
    where: { id: planId },
    data: {
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      side: side || null,
      diagnosis: diagnosis || null,
      planNote: planNote || null,
      planData,
    },
  });

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/patients/${plan.patientId}`);
  redirect(`/plans/${planId}`);
}

export async function updateOpPlanStatus(planId: string, status: string) {
  await verifySession();
  const plan = await prisma.opPlan.update({
    where: { id: planId },
    data: { status },
  });
  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/patients/${plan.patientId}`);
}

export async function deleteOpPlan(planId: string, patientId: string) {
  await verifySession();
  await prisma.opPlan.delete({ where: { id: planId } });
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}
