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

// 외래 스케줄 자동 판단(사용자 2026-10-26 "외래 예약 명단 보고 잡으면 되잖아"):
// 외래가 있던·있을 날짜(지난 외래 명단 + YES 첫 화면 캘린더 예약)를 요일별로 모아, 날짜 간격이 모두 14일의 배수면 격주(기준일 = 가장 이른 날),
// 7일 간격이 하나라도 있으면 매주. 날짜가 1개뿐인 요일은 매주로 본다(판단할 근거 없음). 오전·오후는 그 요일 명단 첫 진료 시각(12시 전 = 오전)
export function inferSchedule(dates: string[], firstTimeByWeekday: Map<number, string> = new Map()): ClinicSession[] {
  const byWd = new Map<number, string[]>();
  for (const d of [...new Set(dates)].sort()) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    byWd.set(wd, [...(byWd.get(wd) ?? []), d]);
  }
  return [...byWd.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, ds]) => {
      const gaps = ds.slice(1).map((d, i) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${ds[i]}T00:00:00Z`)) / 86_400_000));
      const biweekly = gaps.length > 0 && gaps.every((g) => g % 14 === 0);
      const t = firstTimeByWeekday.get(weekday);
      const session: "AM" | "PM" = t && /^\d{1,2}:\d{2}/.test(t) && Number(t.split(":")[0]) >= 12 ? "PM" : "AM";
      return { weekday, session, ...(biweekly ? { everyOtherFrom: ds[0] } : {}) };
    });
}

// YES 첫 화면 캘린더(내 외래일별 예약 인원) — 병원 PC가 매일 아침 올린다
export const ClinicCalendarBodySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), count: z.number().int().min(0).max(999) })).max(400),
});

export const PLAN_TYPES ={ surgery: "수술", medication: "약물치료", observation: "경과관찰", return: "회송" } as const;

export const PatientCareBodySchema = z.object({
  chartNo: z.string().trim().regex(/^\d{4,12}$/),
  planType: z.enum(["surgery", "medication", "observation", "return"]).nullable().optional(),
  nextVisit: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nextVisitLabel: z.string().max(20).nullable().optional(),
});
