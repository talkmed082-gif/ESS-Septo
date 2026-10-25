import * as z from "zod";

// 교수님별 외래 인원·수술 — 병원 PC(prof_schedule.ps1)가 평일 아침 앞으로 2주치를 올린다(사용자 2026-10-25).
// 외래는 인원 수만, 수술은 텔레그램 수술 알림과 같은 수준(이름 가운데 가림·나이/성별·등록번호·수술명).
export const PROFESSORS = ["박지환", "문수진", "정일구", "최성욱"] as const;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ProfSurgerySchema = z.object({
  name: z.string().max(20),
  age: z.string().max(10).optional().default(""),
  sex: z.string().max(4).optional().default(""),
  chartNo: z.string().max(20),
  op: z.string().max(300),
});
export type ProfSurgery = z.infer<typeof ProfSurgerySchema>;

export const ProfScheduleBodySchema = z
  .object({
    from: ymd,
    to: ymd,
    items: z
      .array(
        z.object({
          date: ymd,
          doctor: z.enum(PROFESSORS),
          outpatient: z.number().int().min(0).max(1000),
          surgeries: z.array(ProfSurgerySchema).max(50),
          // 그날 부재(휴가·출장·반일 휴가) — 사유·종류는 안 받음(2026-10-26)
          off: z.enum(["휴가", "출장", "반일 휴가"]).nullable().optional().default(null),
        }),
      )
      .max(500),
  })
  .refine((b) => b.from <= b.to && b.items.every((i) => b.from <= i.date && i.date <= b.to), "기간 밖 날짜가 있습니다.");
export type ProfScheduleBody = z.infer<typeof ProfScheduleBodySchema>;

export function parseProfSurgeries(value: unknown): ProfSurgery[] {
  const p = z.array(ProfSurgerySchema).safeParse(value);
  return p.success ? p.data : [];
}
