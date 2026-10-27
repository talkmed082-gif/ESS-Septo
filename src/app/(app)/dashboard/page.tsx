import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { findPause, kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { ProfTable } from "@/components/prof-table";
import { loadSchedule, md, OutpatientTable, PlanList, ScheduleCalendar, toPlanItem } from "@/components/schedule-calendar";
import { myDay, scheduleDay } from "@/lib/my-week";
import { TodaySchedule } from "./today-schedule";

// 첫 화면(대시보드, 사용자 2026-10-25) — 맨 위 오늘 내 일정(주간 일정표 + 그날 교수님 수술·외래, 내 외래·수술), 2주 달력,
// 교수님 2주 외래·수술·휴가 표, 가장 가까운 외래 환자, 2주 안 수술, 할 일(일정 알림·기록지 미작성). 오늘의 번호는 위쪽 메뉴에 있어 여기선 뺌(사용자).
// 외래 명단은 병원 PC가 평일 아침 14일치를 올린다(outpatient_refresh.ps1).
const DAYS = 14;
const box = "rounded-lg border border-slate-200 bg-white p-4";
const h2 = "mb-2 text-sm font-semibold text-slate-700";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await getCurrentUser();
  const nameStyle: NameStyle = { sideNotation: user.sideNotation as SideNotation, abbreviateRegions: user.abbreviateRegions };
  const now = new Date();
  const today = kstDate(now);
  const end = kstDate(now, DAYS - 1);
  const { day: dayParam } = await searchParams;
  const day = typeof dayParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) && dayParam >= today && dayParam <= end ? dayParam : undefined;

  const sday = scheduleDay(today);
  const [pauses, lists, schedule, overduePlans, reminders] = await Promise.all([
    prisma.automationPause.findMany({ where: { createdById: user.id, from: { lte: sday }, to: { gte: sday } }, select: { from: true, to: true, note: true } }),
    prisma.outpatientList.findMany({
      where: { createdById: user.id, date: { gte: today } },
      orderBy: { date: "asc" },
      take: 20,
      select: { date: true, clinic: true, rows: true },
    }),
    loadSchedule(user.id, nameStyle, today, end),
    // 수술일이 지났는데 기록지가 없는 계획
    prisma.opPlan.findMany({
      where: { createdById: user.id, plannedDate: { lt: new Date(today) }, opRecord: null, status: { not: "DONE" } },
      orderBy: { plannedDate: "desc" },
      take: 20,
      select: { id: true, plannedDate: true, planData: true, patient: { select: { name: true } }, surgeryType: { select: { code: true, name: true } } },
    }),
    // 기한 지남 + 2주 안 기한
    prisma.reminder.findMany({
      where: { createdById: user.id, dueDate: { lte: new Date(end) }, doneAt: null },
      orderBy: { dueDate: "asc" },
      take: 30,
      select: { id: true, title: true, dueDate: true, patient: { select: { id: true, name: true } } },
    }),
  ]);

  // 2주 안 수술 목록은 아직 안 끝난 것만(달력에는 완료 표시한 것도 보임)
  const planItems = [...schedule.plans.values()].flat().filter((p) => !p.done);
  const overdueItems = overduePlans.map((p) => toPlanItem(p, nameStyle));

  const rowsOf = (l: { rows: unknown }) => l.rows as OutpatientRow[];
  const nearest = lists.find((l) => rowsOf(l).length > 0);
  const nearestRows = nearest ? rowsOf(nearest) : [];


  const dates = Array.from({ length: DAYS }, (_, i) => kstDate(now, i));
  const sList = schedule.lists.get(sday);
  const pause = findPause(pauses, sday);
  const slots = myDay(sday, {
    profs: schedule.profs.get(sday) ?? [],
    myOpd: { count: sList?.rows.length ?? 0, clinic: sList?.clinic ?? null },
    myPlans: (schedule.plans.get(sday) ?? []).filter((p) => !p.cancelled).map((p) => ({ id: p.id, name: p.name, procedure: p.procedure })),
    pause: pause ? { note: pause.note } : null,
  });

  return (
    <div className="space-y-4">
      <TodaySchedule date={sday} today={today} slots={slots} />

      <section className={box}>
        <h2 className={h2}>
          2주 일정
          <Link href="/calendar" className="ml-2 font-normal text-emerald-700 underline">
            캘린더에서 한 달 보기
          </Link>
        </h2>
        <ScheduleCalendar dates={dates} today={today} selected={day} data={schedule} dayHref={(d) => `/dashboard?day=${d}#day`} />
      </section>

      <section className={box}>
        <h2 className={h2}>교수님 2주 외래·수술·휴가</h2>
        <ProfTable dates={dates} today={today} profs={schedule.profs} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={box}>
          <h2 className={h2}>
            가장 가까운 외래
            {nearest && (
              <Link href={`/outpatient?date=${nearest.date}`} className="ml-2 font-normal text-emerald-700 underline">
                {md(nearest.date)} {nearest.clinic} · {nearestRows.length}명
              </Link>
            )}
          </h2>
          {nearest ? <OutpatientTable rows={nearestRows} date={nearest.date} /> : <p className="text-sm text-slate-400">올라온 외래 명단이 없습니다.</p>}
        </section>

        <section className={box}>
          <h2 className={h2}>
            2주 안 수술 <span className="font-normal text-slate-400">({planItems.length}건)</span>
          </h2>
          {planItems.length ? <PlanList plans={planItems} /> : <p className="text-sm text-slate-400">2주 안 예정된 수술이 없습니다.</p>}
        </section>
      </div>

      <section className={box}>
        <h2 className={h2}>할 일</h2>
        {/* 외래 환자 로드맵 할 일 목록은 뺐다(사용자 2026-10-27 "외래에서 할일 다 줄줄 늘어놓는거 빼") — 외래 진료 화면에 환자별로 있음 */}
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">일정 알림 (기한 지남·2주 안)</p>
            {reminders.length ? (
              <ul className="space-y-1">
                {reminders.map((r) => {
                  const due = safeDateStr(r.dueDate) ?? "";
                  return (
                    <li key={r.id}>
                      <Link href={`/patients/${r.patient.id}#reminders`} className="hover:underline">
                        <span className={`mr-2 ${due < today ? "text-red-600" : "text-slate-500"}`}>{md(due)}</span>
                        {r.patient.name} · {r.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-slate-400">없음</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">수술 기록지 미작성</p>
            {overdueItems.length ? <PlanList plans={overdueItems} /> : <p className="text-slate-400">없음</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
