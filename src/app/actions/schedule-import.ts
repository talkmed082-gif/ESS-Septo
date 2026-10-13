"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { parseScheduleWorkbook, ScheduleFormatError, type ScheduleRow } from "@/lib/schedule-workbook";
import {
  mapScheduleProcedure,
  previewStatusOf,
  type ImportSurgeryCode,
  type PreviewStatus,
} from "@/lib/schedule-import";
import { existingPlan, importScheduleRows, ScheduleRowSchema } from "@/lib/schedule-import-store";

export interface PreviewRow extends ScheduleRow {
  code: ImportSurgeryCode | null;
  status: PreviewStatus;
}
export interface PreviewState {
  rows?: PreviewRow[];
  message?: string;
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
      const exists = code && row.chartNo.trim() ? await existingPlan(user.id, row.chartNo, row.date, code) : null;
      return { ...row, code, status: previewStatusOf(row, code, !!exists) };
    }),
  );
  return preview.length ? { rows: preview } : { rows: [], message: `${user.name} 교수님 수술이 이 파일에 없습니다.` };
}

export async function importSchedule(
  input: ScheduleRow[],
): Promise<{ created: number; skipped: number; message?: string }> {
  const user = await getCurrentUser();
  const parsed = z.array(ScheduleRowSchema).safeParse(input);
  if (!parsed.success) return { created: 0, skipped: 0, message: "가져올 행 형식이 올바르지 않습니다." };

  const result = await importScheduleRows(user, parsed.data);
  revalidatePath("/patients");
  return result;
}
