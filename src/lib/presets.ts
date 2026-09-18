import "server-only";
import { prisma } from "@/lib/prisma";
import { parseFieldValues, type FieldValues } from "@/lib/field-types";

export interface PresetItem {
  id: string;
  name: string;
  values: FieldValues;
}

export async function getPresetsForSurgeryType(
  userId: string,
  surgeryTypeId: string,
): Promise<PresetItem[]> {
  const rows = await prisma.surgeryPreset.findMany({
    where: { createdById: userId, surgeryTypeId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, values: parseFieldValues(r.fieldValues) }));
}

export async function getPresetsForSurgeryTypes(
  userId: string,
  surgeryTypeIds: string[],
): Promise<Record<string, PresetItem[]>> {
  const rows = await prisma.surgeryPreset.findMany({
    where: { createdById: userId, surgeryTypeId: { in: surgeryTypeIds } },
    orderBy: { createdAt: "desc" },
  });
  const map: Record<string, PresetItem[]> = {};
  for (const id of surgeryTypeIds) map[id] = [];
  for (const r of rows) {
    (map[r.surgeryTypeId] ??= []).push({
      id: r.id,
      name: r.name,
      values: parseFieldValues(r.fieldValues),
    });
  }
  return map;
}
