"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseScheduleWorkbook, ScheduleFormatError, type ScheduleRow } from "@/lib/schedule-workbook";
import {
  buildImportPlanData,
  buildImportPlanNote,
  mapScheduleProcedure,
  parseScheduleAge,
  type ImportSurgeryCode,
} from "@/lib/schedule-import";

export type PreviewStatus = "new" | "exists" | "unsupported";
export interface PreviewRow extends ScheduleRow {
  code: ImportSurgeryCode | null;
  status: PreviewStatus;
}
export interface PreviewState {
  rows?: PreviewRow[];
  message?: string;
}

// 같은 환자(등록번호) + 같은 날짜 + 같은 수술 종류 계획이 이미 있는지
async function existingPlan(userId: string, chartNo: string, date: string, code: ImportSurgeryCode) {
  return prisma.opPlan.findFirst({
    where: {
      createdById: userId,
      plannedDate: new Date(date),
      surgeryType: { code },
      patient: { chartNo, createdById: userId },
    },
    select: { id: true },
  });
}

// 엑셀은 서버 메모리에서만 읽고 버린다 — 다른 교수님 행은 parseScheduleWorkbook이
// 이미 걸러서, 응답에는 내 행만 실린다. 로그에는 건수만 남긴다.
export async function previewSchedule(_prev: PreviewState | undefined, formData: FormData): Promise<PreviewState> {
  const user = await getCurrentUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "엑셀 파일을 고르세요." };

  let rows: ScheduleRow[];
  try {
    rows = await parseScheduleWorkbook(await file.arrayBuffer(), user.name);
  } catch (e) {
    if (e instanceof ScheduleFormatError) return { message: e.message };
    throw e;
  }
  console.info(`[schedule-import] preview rows=${rows.length}`);

  const preview = await Promise.all(
    rows.map(async (row): Promise<PreviewRow> => {
      const { code } = mapScheduleProcedure(row.procedure);
      if (!code) return { ...row, code, status: "unsupported" };
      const exists = row.chartNo ? await existingPlan(user.id, row.chartNo, row.date, code) : null;
      return { ...row, code, status: exists ? "exists" : "new" };
    }),
  );
  return preview.length ? { rows: preview } : { rows: [], message: `${user.name} 교수님 수술이 이 파일에 없습니다.` };
}

const RowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  room: z.string(),
  order: z.string(),
  surgeon: z.string(),
  assist: z.string(),
  chartNo: z.string().min(1),
  name: z.string(),
  sex: z.string(),
  age: z.string(),
  diagnosis: z.string(),
  procedure: z.string(),
  anesthesia: z.string(),
  duration: z.string(),
  note: z.string(),
});

export async function importSchedule(
  input: ScheduleRow[],
): Promise<{ created: number; skipped: number; message?: string }> {
  const user = await getCurrentUser();
  const parsed = z.array(RowSchema).safeParse(input);
  if (!parsed.success) return { created: 0, skipped: 0, message: "가져올 행 형식이 올바르지 않습니다." };

  const types = await prisma.surgeryType.findMany({ where: { code: { in: ["ESS", "SEPTOPLASTY", "COMBO"] } } });
  let created = 0;
  let skipped = 0;
  for (const row of parsed.data) {
    const mapping = mapScheduleProcedure(row.procedure);
    const code = mapping.code;
    const type = code ? types.find((t) => t.code === code) : undefined;
    if (
      row.surgeon.trim() !== user.name.trim() ||
      !code ||
      !type ||
      (await existingPlan(user.id, row.chartNo, row.date, code))
    ) {
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const patient =
        (await tx.patient.findFirst({ where: { chartNo: row.chartNo, createdById: user.id } })) ??
        (await tx.patient.create({
          data: {
            chartNo: row.chartNo,
            name: row.name || row.chartNo,
            sex: row.sex === "M" || row.sex === "F" ? row.sex : null,
            age: parseScheduleAge(row.age),
            createdById: user.id,
          },
        }));
      await tx.opPlan.create({
        data: {
          patientId: patient.id,
          surgeryTypeId: type.id,
          plannedDate: new Date(row.date),
          diagnosis: row.diagnosis || null,
          planNote: buildImportPlanNote(row),
          planData: buildImportPlanData({ code, overrides: mapping.overrides }),
          status: "PLANNED",
          createdById: user.id,
        },
      });
    });
    created++;
  }
  console.info(`[schedule-import] created=${created} skipped=${skipped}`);
  revalidatePath("/patients");
  return { created, skipped };
}
