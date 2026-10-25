import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getDailyOtp } from "@/lib/device-auth";
import { rotateOtp, endAllDeviceSessions } from "@/app/actions/device";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { latestRoadmaps } from "@/lib/roadmap-store";
import { type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { TodoList } from "./todo-list";
import { loadSchedule, md, OutpatientTable, PlanList, ScheduleCalendar, toPlanItem } from "@/components/schedule-calendar";

// 첫 화면(대시보드, 사용자 2026-10-25) — 오늘의 번호, 가장 가까운 외래 환자, 2주 안 수술, 할 일(로드맵·일정 알림·기록지 미작성),
// 2주 달력(날짜를 누르면 그날 외래·수술 환자). 외래 명단은 병원 PC가 평일 아침 14일치를 올린다(outpatient_refresh.ps1).
const DAYS = 14;
const box = "rounded-lg border border-slate-200 bg-white p-4";
const h2 = "mb-2 text-sm font-semibold text-slate-700";

// 로드맵 글에서 □ 할 일만(외래 명단 RoadmapBox와 같은 규칙)
function todoItems(text: string) {
  return text.split("\n").flatMap((line) =>
    line
      .split(/(□[^□]+)/)
      .filter((p) => p.startsWith("□"))
      .map((p) => p.slice(1).trim())
      .filter(Boolean),
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await getCurrentUser();
  const nameStyle: NameStyle = { sideNotation: user.sideNotation as SideNotation, abbreviateRegions: user.abbreviateRegions };
  const now = new Date();
  const today = kstDate(now);
  const end = kstDate(now, DAYS - 1);
  const { day: dayParam } = await searchParams;
  const day = typeof dayParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) && dayParam >= today && dayParam <= end ? dayParam : undefined;

  const [otp, activeDevices, lists, schedule, overduePlans, reminders] = await Promise.all([
    getDailyOtp(user.id, now),
    prisma.deviceSession.count({ where: { createdById: user.id, expiresAt: { gt: now } } }),
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
      where: { createdById: user.id, dueDate: { lte: new Date(end) } },
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

  const roadmaps = await latestRoadmaps(user.id, nearestRows.map((r) => r.chartNo).filter(Boolean));
  const todoGroups = nearestRows.flatMap((r) => {
    const rm = roadmaps.get(r.chartNo);
    const items = rm ? todoItems(rm.text) : [];
    return items.length ? [{ chartNo: r.chartNo, name: r.name, items: items.map((item) => ({ versionId: rm!.id, item, done: rm!.done.includes(item) })) }] : [];
  });

  const dates = Array.from({ length: DAYS }, (_, i) => kstDate(now, i));

  return (
    <div className="space-y-4">
      <section id="otp" className={`${box} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-xs text-slate-500">오늘의 번호 · 진료실 PC 프로그램 연결</p>
          <p className="font-mono text-3xl font-semibold tracking-[0.25em] text-slate-900">{otp.code}</p>
          <p className="text-xs text-slate-400">오늘 자정까지 여러 번 쓸 수 있음{activeDevices > 0 && ` · 연결된 프로그램 ${activeDevices}개`}</p>
        </div>
        <div className="flex gap-2">
          <form action={rotateOtp}>
            <button type="submit" className={buttonStyles.smallOutline}>
              새 번호
            </button>
          </form>
          {activeDevices > 0 && (
            <form action={endAllDeviceSessions}>
              <button type="submit" className={buttonStyles.smallOutline}>
                연결 모두 끊기
              </button>
            </form>
          )}
        </div>
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
          {nearest ? <OutpatientTable rows={nearestRows} /> : <p className="text-sm text-slate-400">올라온 외래 명단이 없습니다.</p>}
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
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">로드맵 할 일{nearest && ` (${md(nearest.date)} 외래 환자)`}</p>
            {todoGroups.length ? (
              <div className="space-y-2">
                {todoGroups.map((g) => (
                  <div key={g.chartNo}>
                    <p className="font-medium">{g.name}</p>
                    <TodoList items={g.items} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">없음</p>
            )}
          </div>
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

      <section className={box}>
        <h2 className={h2}>
          2주 일정
          <Link href="/calendar" className="ml-2 font-normal text-emerald-700 underline">
            캘린더에서 한 달 보기
          </Link>
        </h2>
        <ScheduleCalendar dates={dates} today={today} selected={day} data={schedule} dayHref={(d) => `/dashboard?day=${d}#day`} />
      </section>
    </div>
  );
}
