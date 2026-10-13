import "server-only";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import type { ScheduleRow } from "@/lib/schedule-workbook";
import {
  buildImportPlanData,
  buildImportPlanNote,
  mapScheduleProcedure,
  parseScheduleAge,
  type ImportSurgeryCode,
} from "@/lib/schedule-import";

// 엑셀 업로드 화면(actions/schedule-import)과 병원 PC 자동 등록(api/schedule-import)이
// 같이 쓰는 저장 로직 — 환자는 등록번호로 찾아 재사용하고, 같은 계획은 다시 만들지 않는다.

export const ScheduleRowSchema = z.object({
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

// 같은 환자(등록번호) + 같은 날짜 + 같은 수술 종류 계획이 이미 있는지
export async function existingPlan(userId: string, chartNo: string, date: string, code: ImportSurgeryCode) {
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

// 집도의가 이 계정 이름과 다른 행, ESS/Septo 계열이 아닌 행, 이미 있는 계획은 건너뛴다.
export async function importScheduleRows(
  user: { id: string; name: string },
  rows: ScheduleRow[],
): Promise<{ created: number; skipped: number }> {
  const types = await prisma.surgeryType.findMany({ where: { code: { in: ["ESS", "SEPTOPLASTY", "COMBO"] } } });
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
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
  return { created, skipped };
}
