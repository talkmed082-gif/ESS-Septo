"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, fieldValuesFromFormData } from "@/lib/field-types";

const PatientPlanSchema = z
  .object({
    existingPatientId: z.string().trim().optional(),
    name: z.string().trim().optional(),
    chartNo: z.string().trim().optional(),
    sex: z.enum(["M", "F", ""]).optional(),
    age: z.string().trim().optional(),
    memo: z.string().trim().optional(),
    surgeryTypeId: z.string().trim().optional(),
    plannedDate: z.string().trim().optional(),
    planNote: z.string().trim().optional(),
  })
  .refine((data) => data.existingPatientId || (data.name && data.name.length > 0), {
    error: "환자를 선택하거나 이름을 입력하세요.",
    path: ["name"],
  });

export interface PatientPlanFormState {
  errors?: Record<string, string[]>;
  message?: string;
}

function parseAge(age: string | undefined): number | null {
  if (!age) return null;
  const n = Number(age);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// 새 환자를 등록하거나(기존 환자 선택 안 함) 기존 환자를 그대로 쓰거나
// (existingPatientId) 한 화면에서 처리한다 — 퀵 도구/새 환자 등록/기존
// 환자의 새 계획 작성을 같은 컴포넌트·같은 액션으로 통일하기 위함.
export async function createPatientWithPlan(
  _prevState: PatientPlanFormState | undefined,
  formData: FormData,
): Promise<PatientPlanFormState> {
  const session = await verifySession();

  const validated = PatientPlanSchema.safeParse({
    existingPatientId: formData.get("existingPatientId") ?? "",
    name: formData.get("name") ?? "",
    chartNo: formData.get("chartNo") ?? "",
    sex: formData.get("sex") ?? "",
    age: formData.get("age") ?? "",
    memo: formData.get("memo") ?? "",
    surgeryTypeId: formData.get("surgeryTypeId") ?? "",
    plannedDate: formData.get("plannedDate") ?? "",
    planNote: formData.get("planNote") ?? "",
  });
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }
  const data = validated.data;

  const surgeryType = data.surgeryTypeId
    ? await prisma.surgeryType.findUnique({ where: { id: data.surgeryTypeId } })
    : null;
  if (data.surgeryTypeId && !surgeryType) {
    return { message: "수술 종류를 다시 선택하세요." };
  }

  let patientId: string;
  if (data.existingPatientId) {
    const existing = await prisma.patient.findUnique({ where: { id: data.existingPatientId } });
    if (!existing) return { message: "환자를 다시 선택하세요." };
    patientId = existing.id;
  } else {
    const patient = await prisma.patient.create({
      data: {
        name: data.name as string,
        chartNo: data.chartNo || null,
        sex: data.sex || null,
        age: parseAge(data.age),
        memo: data.memo || null,
        createdById: session.userId,
      },
    });
    patientId = patient.id;
  }

  if (!surgeryType) {
    revalidatePath("/patients");
    redirect(`/patients/${patientId}`);
  }

  const fields = parseFieldDefs(surgeryType.fields);
  const planData = fieldValuesFromFormData(formData, fields);

  const plan = await prisma.opPlan.create({
    data: {
      patientId,
      surgeryTypeId: surgeryType.id,
      plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
      planNote: data.planNote || null,
      planData,
      createdById: session.userId,
    },
  });

  revalidatePath("/patients");
  redirect(`/plans/${plan.id}`);
}
