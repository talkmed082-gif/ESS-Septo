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
  age: z.string().trim().optional(),
  memo: z.string().trim().optional(),
});

export interface PatientFormState {
  errors?: {
    name?: string[];
    chartNo?: string[];
    sex?: string[];
    age?: string[];
    memo?: string[];
  };
  message?: string;
}

function parsePatientFormData(formData: FormData) {
  return PatientSchema.safeParse({
    name: formData.get("name"),
    chartNo: formData.get("chartNo"),
    sex: formData.get("sex"),
    age: formData.get("age"),
    memo: formData.get("memo"),
  });
}

function parseAge(age: string | undefined): number | null {
  if (!age) return null;
  const n = Number(age);
  return Number.isInteger(n) && n >= 0 ? n : null;
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
  const { name, chartNo, sex, age, memo } = validated.data;

  const patient = await prisma.patient.create({
    data: {
      name,
      chartNo: chartNo || null,
      sex: sex || null,
      age: parseAge(age),
      memo: memo || null,
      createdById: session.userId,
    },
  });

  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

// 환자 목록에서 왔으면 목록으로, 환자 상세 화면에서 왔으면 그 화면으로
// 돌아가게 한다 — 링크에 실어 보낸 경로만 신뢰하고, 그 외(비어있거나
// 외부 주소로 유도하려는 값)는 안전하게 목록으로 대체한다.
function safeReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/patients";
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
  const { name, chartNo, sex, age, memo } = validated.data;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      name,
      chartNo: chartNo || null,
      sex: sex || null,
      age: parseAge(age),
      memo: memo || null,
    },
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  redirect(safeReturnPath(formData.get("returnTo")));
}

export async function deletePatient(patientId: string) {
  await verifySession();
  await prisma.patient.delete({ where: { id: patientId } });
  revalidatePath("/patients");
  redirect("/patients");
}

export async function deletePatients(_prevState: unknown, formData: FormData) {
  await verifySession();
  const ids = formData.getAll("ids").filter((v): v is string => typeof v === "string");
  if (ids.length > 0) {
    await prisma.patient.deleteMany({ where: { id: { in: ids } } });
  }
  revalidatePath("/patients");
  redirect("/patients");
}
