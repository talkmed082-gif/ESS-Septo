import "server-only";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { inferSchedule, parseSchedule, type ClinicSession } from "@/lib/clinic-schedule";

// 다음 외래 계산에 쓸 스케줄: 설정에서 손으로 저장한 게 있으면 그것, 없으면 외래 예약 명단으로 자동 판단(사용자 2026-10-26).
// 자동 판단 근거 = 최근 120일 외래 명단(환자 있는 날) + YES 캘린더 예약(앞으로)
export async function effectiveSchedule(userId: string): Promise<{ schedule: ClinicSession[]; source: "manual" | "auto" | "none" }> {
  const [u, lists] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { clinicSchedule: true, clinicCalendar: true } }),
    prisma.outpatientList.findMany({ where: { createdById: userId, date: { gte: kstDate(new Date(), -120) } }, select: { date: true, rows: true } }),
  ]);
  const manual = parseSchedule(u?.clinicSchedule);
  if (manual.length) return { schedule: manual, source: "manual" };
  const listed = lists.filter((l) => Array.isArray(l.rows) && l.rows.length > 0);
  const firstTime = new Map<number, string>();
  for (const l of listed.sort((a, b) => b.date.localeCompare(a.date))) {
    const wd = new Date(`${l.date}T00:00:00Z`).getUTCDay();
    const t = (l.rows as OutpatientRow[]).map((r) => r.time).filter((x) => /^\d{1,2}:\d{2}/.test(x)).sort()[0];
    if (t && !firstTime.has(wd)) firstTime.set(wd, t);
  }
  const cal = Array.isArray(u?.clinicCalendar) ? (u!.clinicCalendar as { date?: unknown; count?: unknown }[]) : [];
  const calDates = cal.filter((d) => typeof d.date === "string" && Number(d.count) > 0).map((d) => d.date as string);
  const schedule = inferSchedule([...listed.map((l) => l.date), ...calDates], firstTime);
  return { schedule, source: schedule.length ? "auto" : "none" };
}
