"use server";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import type { FieldValues } from "@/lib/field-types";

export async function createSurgeryPreset(
  surgeryTypeId: string,
  name: string,
  values: FieldValues,
) {
  const session = await verifySession();
  const preset = await prisma.surgeryPreset.create({
    data: {
      name,
      surgeryTypeId,
      fieldValues: values,
      createdById: session.userId,
    },
  });
  return { id: preset.id, name: preset.name, values };
}

export async function deleteSurgeryPreset(id: string) {
  const session = await verifySession();
  await prisma.surgeryPreset.deleteMany({
    where: { id, createdById: session.userId },
  });
}
