import * as z from "zod";

// 내 외래 스케줄 — 요일별 오전/오후. 다음 외래 날짜 계산: 고른 간격 뒤 날짜부터 처음 오는 외래일(휴진 기간은 건너뜀)
// everyOtherFrom: 격주 외래(사용자 2026-10-26 금 오전 격주) — 이 날짜가 든 주와 짝이 맞는 주(2주 간격)만 외래.
// YES 첫 화면 캘린더(예약 인원)로 확인: 금 11/6·11/20·12/4·12/18
export const ClinicSessionSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  session: z.enum(["AM", "PM"]),
  everyOtherFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
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

// 그 주 월요일(UTC 날짜 계산)
function mondayOf(ymd: string) {
  const wd = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return addDays(ymd, -((wd + 6) % 7));
}
// 격주 기준일과 같은 짝의 주인가
function sameParityWeek(anchor: string, d: string) {
  const weeks = Math.round((Date.parse(`${mondayOf(d)}T00:00:00Z`) - Date.parse(`${mondayOf(anchor)}T00:00:00Z`)) / (7 * 86_400_000));
  return weeks % 2 === 0;
}
// 그날 열리는 외래(격주면 짝 맞는 주만)
export function sessionsOn(d: string, schedule: ClinicSession[]) {
  const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
  return schedule.filter((s) => s.weekday === wd && (!s.everyOtherFrom || sameParityWeek(s.everyOtherFrom, d)));
}

type NextDate = { date: string; weekday: string; sessions: string[] };
const isPaused = (d: string, pauses: { from: string; to: string }[]) => pauses.some((p) => p.from <= d && d <= p.to);
const label = (s: ClinicSession[]) => s.map((x) => (x.session === "AM" ? "오전" : "오후"));

// from(yyyy-MM-dd, 서울 오늘) + days 이후 첫 외래일. 스케줄이 비면 그 날짜 그대로(요일만 붙임). 1년 안에 없으면 null
export function nextClinicDate(from: string, days: number, schedule: ClinicSession[], pauses: { from: string; to: string }[]): NextDate | null {
  const target = addDays(from, days);
  for (let i = 0; i < 366; i++) {
    const d = addDays(target, i);
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    const on = sessionsOn(d, schedule);
    if (schedule.length && !on.length) continue;
    if (isPaused(d, pauses)) continue;
    return { date: d, weekday: WEEKDAY[wd], sessions: label(on) };
  }
  return null;
}

// 요일마다 가장 가까운 외래일(화·금처럼 외래 요일이 여럿이면 둘 다 고를 수 있게 — 사용자 2026-10-26 "상관없이 왔다갔다 해도 돼").
// 날짜순. 스케줄이 비면 빈 배열
export function nextClinicDatesByWeekday(from: string, days: number, schedule: ClinicSession[], pauses: { from: string; to: string }[]): NextDate[] {
  const target = addDays(from, days);
  const want = new Set(schedule.map((s) => s.weekday));
  const out: NextDate[] = [];
  for (let i = 0; i < 366 && want.size; i++) {
    const d = addDays(target, i);
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (!want.has(wd)) continue;
    const on = sessionsOn(d, schedule);
    if (!on.length || isPaused(d, pauses)) continue;
    out.push({ date: d, weekday: WEEKDAY[wd], sessions: label(on) });
    want.delete(wd);
  }
  return out;
}

export const PLAN_TYPES = { surgery: "수술", medication: "약물치료", observation: "경과관찰", return: "회송" } as const;

export const PatientCareBodySchema = z.object({
  chartNo: z.string().trim().regex(/^\d{4,12}$/),
  planType: z.enum(["surgery", "medication", "observation", "return"]).nullable().optional(),
  nextVisit: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nextVisitLabel: z.string().max(20).nullable().optional(),
});
