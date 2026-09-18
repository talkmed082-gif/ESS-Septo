"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, fieldValuesFromFormData } from "@/lib/field-types";

const PatientPlanSchema = z.object({
  name: z.string().trim().min(1, { error: "환자 이름을 입력하세요." }),
  chartNo: z.string().trim().optional(),
  sex: z.enum(["M", "F", ""]).optional(),
  birthDate: z.string().trim().optional(),
  memo: z.string().trim().optional(),
  surgeryTypeId: z.string().trim().optional(),
  plannedDate: z.string().trim().optional(),
  side: z.enum(["Rt.", "Lt.", "Both", ""]).optional(),
  diagnosis: z.string().trim().optional(),
  planNote: z.string().trim().optional(),
});

export interface PatientPlanFormState {
  errors?: Record<string, string[]>;
  message?: string;
}

export async function createPatientWithPlan(
  _prevState: PatientPlanFormState | undefined,
  formData: FormData,
): Promise<PatientPlanFormState> {
  const session = await verifySession();

  const validated = PatientPlanSchema.safeParse({
    name: formData.get("name") ?? "",
    chartNo: formData.get("chartNo") ?? "",
    sex: formData.get("sex") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    memo: formData.get("memo") ?? "",
    surgeryTypeId: formData.get("surgeryTypeId") ?? "",
    plannedDate: formData.get("plannedDate") ?? "",
    side: formData.get("side") ?? "",
    diagnosis: formData.get("diagnosis") ?? "",
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

  const patient = await prisma.patient.create({
    data: {
      name: data.name,
      chartNo: data.chartNo || null,
      sex: data.sex || null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      memo: data.memo || null,
      createdById: session.userId,
    },
  });

  if (!surgeryType) {
    revalidatePath("/patients");
    redirect(`/patients/${patient.id}`);
  }

  const fields = parseFieldDefs(surgeryType.fields);
  const planData = fieldValuesFromFormData(formData, fields);

  const plan = await prisma.opPlan.create({
    data: {
      patientId: patient.id,
      surgeryTypeId: surgeryType.id,
      plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
      side: data.side || null,
      diagnosis: data.diagnosis || null,
      planNote: data.planNote || null,
      planData,
      createdById: session.userId,
    },
  });

  revalidatePath("/patients");
  redirect(`/plans/${plan.id}`);
}
