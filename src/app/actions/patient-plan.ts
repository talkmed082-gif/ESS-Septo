"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { fieldValuesFromFormData } from "@/lib/field-types";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";

const PatientPlanSchema = z.object({
  existingPatientId: z.string().trim().optional(),
  name: z.string().trim().optional(),
  chartNo: z.string().trim().optional(),
  sex: z.enum(["M", "F", ""]).optional(),
  age: z.string().trim().optional(),
  memo: z.string().trim().optional(),
  surgeryTypeId: z.string().trim().optional(),
  plannedDate: z.string().trim().optional(),
  planNote: z.string().trim().optional(),
  planStatus: z.enum(["PLANNED", "DONE"]).optional(),
  saveIntent: z.enum(["save", "record"]).optional(),
});

// 이름을 안 적어도 등록할 수 있게(예: 접수 직후 바로 계획부터 잡을 때) —
// 나중에 알아볼 수 있게 등록 날짜·시간으로 이름을 대신 채운다.
function autoPatientName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  // "환자" 접미사를 붙이면 화면마다 이미 붙어있는 "환자"와 겹쳐서(예: "...
  // 환자 환자 수술 계획") 중복돼 보이므로, 이름 자체엔 날짜·시간만 남긴다.
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

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
    planStatus: formData.get("planStatus") || undefined,
    saveIntent: formData.get("saveIntent") || undefined,
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
        name: data.name || autoPatientName(),
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

  const fields = resolveSurgeryTypeFields(surgeryType);
  const planData = fieldValuesFromFormData(formData, fields);

  const plan = await prisma.opPlan.create({
    data: {
      patientId,
      surgeryTypeId: surgeryType.id,
      plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
      planNote: data.planNote || null,
      planData,
      status: data.planStatus ?? "PLANNED",
      createdById: session.userId,
    },
  });

  revalidatePath("/patients");
  // 계획 작성 화면 자체가 환자 기본 화면이라, 만든 뒤 바로 그 계획
  // 화면으로 이동한다. "저장 후 기록지 작성" 버튼으로 저장했으면 수술 후
  // 기본화면(수술 방법·기록지)이 바로 열리게 view를 지정해서 넘긴다.
  redirect(`/plans/${plan.id}${data.saveIntent === "record" ? "?view=post" : ""}`);
}
