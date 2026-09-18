"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, fieldValuesFromFormData } from "@/lib/field-types";

const OpRecordSchema = z.object({
  operationDate: z.string().trim().min(1, { error: "수술일을 입력하세요." }),
  surgeonName: z.string().trim().min(1, { error: "집도의를 입력하세요." }),
  assistantName: z.string().trim().optional(),
  anesthesiaType: z.string().trim().optional(),
  preOpDiagnosis: z.string().trim().optional(),
  postOpDiagnosis: z.string().trim().optional(),
  procedureName: z.string().trim().optional(),
  findings: z.string().trim().optional(),
  procedureDetail: z.string().trim().optional(),
  complication: z.string().trim().optional(),
  estimatedBloodLoss: z.string().trim().optional(),
  specimen: z.string().trim().optional(),
  postOpPlan: z.string().trim().optional(),
});

export interface OpRecordFormState {
  errors?: Record<string, string[]>;
  message?: string;
}

function parseRecordFormData(formData: FormData) {
  return OpRecordSchema.safeParse({
    operationDate: formData.get("operationDate"),
    surgeonName: formData.get("surgeonName"),
    assistantName: formData.get("assistantName"),
    anesthesiaType: formData.get("anesthesiaType"),
    preOpDiagnosis: formData.get("preOpDiagnosis"),
    postOpDiagnosis: formData.get("postOpDiagnosis"),
    procedureName: formData.get("procedureName"),
    findings: formData.get("findings"),
    procedureDetail: formData.get("procedureDetail"),
    complication: formData.get("complication"),
    estimatedBloodLoss: formData.get("estimatedBloodLoss"),
    specimen: formData.get("specimen"),
    postOpPlan: formData.get("postOpPlan"),
  });
}

export async function createOpRecord(
  planId: string,
  _prevState: OpRecordFormState | undefined,
  formData: FormData,
): Promise<OpRecordFormState> {
  const session = await verifySession();

  const plan = await prisma.opPlan.findUnique({
    where: { id: planId },
    include: { surgeryType: true, opRecord: true },
  });
  if (!plan) {
    return { message: "수술 계획을 찾을 수 없습니다." };
  }
  if (plan.opRecord) {
    redirect(`/records/${plan.opRecord.id}`);
  }

  const validated = parseRecordFormData(formData);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }
  const data = validated.data;

  const fields = parseFieldDefs(plan.surgeryType.fields);
  const recordData = fieldValuesFromFormData(formData, fields);

  const record = await prisma.opRecord.create({
    data: {
      opPlanId: planId,
      operationDate: new Date(data.operationDate),
      surgeonName: data.surgeonName,
      assistantName: data.assistantName || null,
      anesthesiaType: data.anesthesiaType || null,
      preOpDiagnosis: data.preOpDiagnosis || null,
      postOpDiagnosis: data.postOpDiagnosis || null,
      procedureName: data.procedureName || null,
      findings: data.findings || null,
      procedureDetail: data.procedureDetail || null,
      recordData,
      complication: data.complication || null,
      estimatedBloodLoss: data.estimatedBloodLoss || null,
      specimen: data.specimen || null,
      postOpPlan: data.postOpPlan || null,
      createdById: session.userId,
    },
  });

  revalidatePath(`/plans/${planId}`);
  revalidatePath(`/patients/${plan.patientId}`);
  redirect(`/records/${record.id}`);
}

export async function updateOpRecord(
  recordId: string,
  _prevState: OpRecordFormState | undefined,
  formData: FormData,
): Promise<OpRecordFormState> {
  await verifySession();

  const record = await prisma.opRecord.findUnique({
    where: { id: recordId },
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

  const fields = parseFieldDefs(record.opPlan.surgeryType.fields);
  const recordData = fieldValuesFromFormData(formData, fields);

  await prisma.opRecord.update({
    where: { id: recordId },
    data: {
      operationDate: new Date(data.operationDate),
      surgeonName: data.surgeonName,
      assistantName: data.assistantName || null,
      anesthesiaType: data.anesthesiaType || null,
      preOpDiagnosis: data.preOpDiagnosis || null,
      postOpDiagnosis: data.postOpDiagnosis || null,
      procedureName: data.procedureName || null,
      findings: data.findings || null,
      procedureDetail: data.procedureDetail || null,
      recordData,
      complication: data.complication || null,
      estimatedBloodLoss: data.estimatedBloodLoss || null,
      specimen: data.specimen || null,
      postOpPlan: data.postOpPlan || null,
    },
  });

  revalidatePath(`/records/${recordId}`);
  redirect(`/records/${recordId}`);
}
