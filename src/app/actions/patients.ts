"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

const PatientSchema = z.object({
  name: z.string().trim().min(1, { error: "환자 이름을 입력하세요." }),
  chartNo: z.string().trim().optional(),
  sex: z.enum(["M", "F", ""]).optional(),
  birthDate: z.string().trim().optional(),
  memo: z.string().trim().optional(),
});

export interface PatientFormState {
  errors?: {
    name?: string[];
    chartNo?: string[];
    sex?: string[];
    birthDate?: string[];
    memo?: string[];
  };
  message?: string;
}

function parsePatientFormData(formData: FormData) {
  return PatientSchema.safeParse({
    name: formData.get("name"),
    chartNo: formData.get("chartNo"),
    sex: formData.get("sex"),
    birthDate: formData.get("birthDate"),
    memo: formData.get("memo"),
  });
}

export async function createPatient(
  _prevState: PatientFormState | undefined,
  formData: FormData,
): Promise<PatientFormState> {
  const session = await verifySession();
  const validated = parsePatientFormData(formData);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }
  const { name, chartNo, sex, birthDate, memo } = validated.data;

  const patient = await prisma.patient.create({
    data: {
      name,
      chartNo: chartNo || null,
      sex: sex || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      memo: memo || null,
      createdById: session.userId,
    },
  });

  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function updatePatient(
  patientId: string,
  _prevState: PatientFormState | undefined,
  formData: FormData,
): Promise<PatientFormState> {
  await verifySession();
  const validated = parsePatientFormData(formData);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }
  const { name, chartNo, sex, birthDate, memo } = validated.data;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      name,
      chartNo: chartNo || null,
      sex: sex || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      memo: memo || null,
    },
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

export async function deletePatient(patientId: string) {
  await verifySession();
  await prisma.patient.delete({ where: { id: patientId } });
  revalidatePath("/patients");
  redirect("/patients");
}
