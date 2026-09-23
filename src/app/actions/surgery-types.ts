"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import type { SurgeryFieldDef } from "@/lib/field-types";
import type { Prisma } from "@/generated/prisma/client";

const FieldDefSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["checkbox", "text", "textarea", "select", "multiselect", "number"]),
  options: z.array(z.string()).optional(),
});

const SurgeryTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: "코드를 입력하세요." })
    .regex(/^[A-Z0-9_]+$/, {
      error: "코드는 영문 대문자/숫자/밑줄만 사용할 수 있습니다.",
    }),
  name: z.string().trim().min(1, { error: "수술 이름을 입력하세요." }),
  fieldsJson: z.string(),
});

export interface SurgeryTypeFormState {
  errors?: {
    code?: string[];
    name?: string[];
    fieldsJson?: string[];
  };
  message?: string;
}

export async function createSurgeryType(
  _prevState: SurgeryTypeFormState | undefined,
  formData: FormData,
): Promise<SurgeryTypeFormState> {
  await verifySession();

  const validated = SurgeryTypeSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    fieldsJson: formData.get("fieldsJson"),
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { code, name, fieldsJson } = validated.data;

  let rawFields: unknown;
  try {
    rawFields = JSON.parse(fieldsJson);
  } catch {
    return { message: "입력 항목 형식이 올바르지 않습니다." };
  }

  const fieldsResult = z.array(FieldDefSchema).safeParse(rawFields);
  if (!fieldsResult.success || fieldsResult.data.length === 0) {
    return { message: "입력 항목을 최소 1개 이상 추가하세요." };
  }
  const fields: SurgeryFieldDef[] = fieldsResult.data;

  const existing = await prisma.surgeryType.findUnique({ where: { code } });
  if (existing) {
    return { errors: { code: ["이미 사용 중인 코드입니다."] } };
  }

  await prisma.surgeryType.create({
    data: {
      code,
      name,
      fields: fields as unknown as Prisma.InputJsonValue,
      isBuiltIn: false,
    },
  });

  revalidatePath("/settings");
  redirect("/settings");
}

export async function deleteSurgeryType(surgeryTypeId: string) {
  await verifySession();
  const surgeryType = await prisma.surgeryType.findUnique({
    where: { id: surgeryTypeId },
  });
  if (!surgeryType || surgeryType.isBuiltIn) {
    return;
  }
  try {
    await prisma.surgeryType.delete({ where: { id: surgeryTypeId } });
  } catch {
    // op plans still reference this surgery type
  }
  revalidatePath("/settings");
}
