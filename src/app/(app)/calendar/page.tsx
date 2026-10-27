import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { kstDate } from "@/lib/hospital-link";
import { type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { buttonStyles } from "@/lib/ui";
import { loadSchedule, ScheduleCalendar } from "@/components/schedule-calendar";
import { shiftMonth } from "../outpatient/outpatient-calendar";
import { RemindersSection } from "../reminders/reminders-section";

// 캘린더 — 내 외래 인원·수술 한 달 보기(사용자 2026-10-25). 날짜를 누르면 그날 외래·수술 환자.
// 외래 명단은 병원 PC가 올린 날짜만 있다(평일 아침 앞으로 14일치).
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await getCurrentUser();
  const nameStyle: NameStyle = { sideNotation: user.sideNotation as SideNotation, abbreviateRegions: user.abbreviateRegions };
  const today = kstDate(new Date());
  const { month: monthParam, day: dayParam } = await searchParams;
  const day = typeof dayParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : undefined;
  const month =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : (day ?? today).slice(0, 7);

  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const schedule = await loadSchedule(user.id, nameStyle, dates[0], dates[dates.length - 1]);
  const selected = day && day.startsWith(month) ? day : undefined;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/calendar?month=${shiftMonth(month, -1)}`} className={buttonStyles.smallOutline} aria-label="이전 달">
          ←
        </Link>
        <h1 className="text-xl font-semibold">
          {y}년 {m}월
        </h1>
        <Link href={`/calendar?month=${shiftMonth(month, 1)}`} className={buttonStyles.smallOutline} aria-label="다음 달">
          →
        </Link>
      </div>
      {month !== today.slice(0, 7) && (
        <p className="text-center text-sm">
          <Link href="/calendar" className="text-emerald-700 underline">
            이번 달로
          </Link>
        </p>
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <ScheduleCalendar
          dates={dates}
          today={today}
          selected={selected}
          data={schedule}
          dayHref={(d) => `/calendar?month=${month}&day=${d}#day`}
        />
      </div>
      {/* 일정 알림은 캘린더 아래(사용자 2026-10-27 "캘린더는 일정 알림이랑 합쳐서") */}
      <div id="reminders" className="scroll-mt-24">
        <RemindersSection />
      </div>
    </div>
  );
}
