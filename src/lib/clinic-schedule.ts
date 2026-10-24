import * as z from "zod";

// 내 외래 스케줄 — 요일별 오전/오후. 다음 외래 날짜 계산: 고른 간격 뒤 날짜부터 처음 오는 외래일(휴진 기간은 건너뜀)
export const ClinicSessionSchema = z.object({ weekday: z.number().int().min(0).max(6), session: z.enum(["AM", "PM"]) });
export const ClinicScheduleSchema = z.array(ClinicSessionSchema).max(14);
export type ClinicSession = z.infer<typeof ClinicSessionSchema>;

export const NEXT_VISIT_OPTIONS = [
  { label: "2주", days: 14 },
  { label: "4주", days: 28 },
  { label: "2개월", days: 56 },
  { label: "3개월", days: 84 },
  { label: "6개월", days: 182 },
] as const;

const WEEKDAY = "일월화수목금토";

export function parseSchedule(value: unknown): ClinicSession[] {
  const p = ClinicScheduleSchema.safeParse(value);
  return p.success ? p.data : [];
}

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// from(yyyy-MM-dd, 서울 오늘) + days 이후 첫 외래일. 스케줄이 비면 그 날짜 그대로(요일만 붙임). 1년 안에 없으면 null
export function nextClinicDate(from: string, days: number, schedule: ClinicSession[], pauses: { from: string; to: string }[]) {
  const target = addDays(from, days);
  const weekdays = new Set(schedule.map((s) => s.weekday));
  for (let i = 0; i < 366; i++) {
    const d = addDays(target, i);
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (weekdays.size && !weekdays.has(wd)) continue;
    if (pauses.some((p) => p.from <= d && d <= p.to)) continue;
    const sessions = schedule.filter((s) => s.weekday === wd).map((s) => (s.session === "AM" ? "오전" : "오후"));
    return { date: d, weekday: WEEKDAY[wd], sessions };
  }
  return null;
}

export const PLAN_TYPES = { surgery: "수술", medication: "약물치료", observation: "경과관찰", return: "회송" } as const;

export const PatientCareBodySchema = z.object({
  chartNo: z.string().trim().regex(/^\d{4,12}$/),
  planType: z.enum(["surgery", "medication", "observation", "return"]).nullable().optional(),
  nextVisit: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nextVisitLabel: z.string().max(20).nullable().optional(),
});
