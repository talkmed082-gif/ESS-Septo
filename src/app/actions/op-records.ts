"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { fieldValuesFromFormData } from "@/lib/field-types";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";

const OpRecordSchema = z.object({
  operationDate: z.string().trim().min(1, { error: "수술일을 입력하세요." }),
  surgeonName: z.string().trim().min(1, { error: "집도의를 입력하세요." }),
  anesthesiaType: z.string().trim().optional(),
  procedureName: z.string().trim().optional(),
  findings: z.string().trim().optional(),
  procedureDetail: z.string().trim().optional(),
});

export interface OpRecordFormState {
  errors?: Record<string, string[]>;
  message?: string;
}

function parseRecordFormData(formData: FormData) {
  return OpRecordSchema.safeParse({
    operationDate: formData.get("operationDate"),
    surgeonName: formData.get("surgeonName"),
    anesthesiaType: formData.get("anesthesiaType"),
    procedureName: formData.get("procedureName"),
    findings: formData.get("findings"),
    procedureDetail: formData.get("procedureDetail"),
  });
}

export async function createOpRecord(
  planId: string,
  _prevState: OpRecordFormState | undefined,
  formData: FormData,
): Promise<OpRecordFormState> {
  const session = await verifySession();

  const plan = await prisma.opPlan.findFirst({
    where: { id: planId, createdById: session.userId },
    include: { surgeryType: true, opRecord: true },
  });
  if (!plan) {
    return { message: "수술 계획을 찾을 수 없습니다." };
  }
  if (plan.opRecord) {
    redirect(`/plans/${planId}`);
  }

  const validated = parseRecordFormData(formData);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }
  const data = validated.data;

  const fields = resolveSurgeryTypeFields(plan.surgeryType);
  const recordData = fieldValuesFromFormData(formData, fields);

  await prisma.opRecord.create({
    data: {
      opPlanId: planId,
      operationDate: new Date(data.operationDate),
      surgeonName: data.surgeonName,
      anesthesiaType: data.anesthesiaType || null,
      procedureName: data.procedureName || null,
      findings: data.findings || null,
      procedureDetail: data.procedureDetail || null,
      recordData,
      createdById: session.userId,
    },
  });

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/patients/${plan.patientId}`);
  // 계획 작성 화면 자체가 환자 기본 화면이라, 기록지를 쓴 뒤에도 그
  // 화면으로 돌아간다(이제 "기록지 보기" 버튼이 나타남).
  redirect(`/plans/${planId}`);
}

export async function updateOpRecord(
  recordId: string,
  _prevState: OpRecordFormState | undefined,
  formData: FormData,
): Promise<OpRecordFormState> {
  const session = await verifySession();

  const record = await prisma.opRecord.findFirst({
    where: { id: recordId, createdById: session.userId },
    include: { opPlan: { include: { surgeryType: true } } },
  });
  if (!record) {
    return { message: "기록지를 찾을 수 없습니다." };
  }

  const validated = parseRecordFormData(formData);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }
  const data = validated.data;

  const fields = resolveSurgeryTypeFields(record.opPlan.surgeryType);
  const recordData = fieldValuesFromFormData(formData, fields);

  await prisma.opRecord.update({ // ownership-checked above
    where: { id: recordId },
    data: {
      operationDate: new Date(data.operationDate),
      surgeonName: data.surgeonName,
      anesthesiaType: data.anesthesiaType || null,
      procedureName: data.procedureName || null,
      findings: data.findings || null,
      procedureDetail: data.procedureDetail || null,
      recordData,
    },
  });

  revalidatePath(`/records/${recordId}`);
  revalidatePath(`/plans/${record.opPlan.id}`);
  revalidatePath(`/patients/${record.opPlan.patientId}`);
  // 계획 작성 화면 자체가 환자 기본 화면이라, 기록지 수정 후에도 그
  // 화면으로 돌아간다.
  redirect(`/plans/${record.opPlan.id}`);
}
