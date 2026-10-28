import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { type OutpatientRow } from "@/lib/hospital-link";
import { parseFieldValues } from "@/lib/field-types";
import { procedureNameFor, type NameStyle } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { isCancelledRoom, offLabel, parseProfSurgeries, planNoteRoom, PROFESSORS, roomLabel, splitCancelled, type ProfSurgery } from "@/lib/prof-schedule";
import { profCellLines } from "@/lib/my-week";

// 내 일정 달력(외래 인원·수술) — 대시보드 2주 달력과 캘린더 메뉴(한 달)가 같이 쓴다(사용자 2026-10-25).
// 날짜를 누르면 그날 외래·수술 환자 목록이 아래에 뜬다. 교수님 4분 외래 인원·수술도 같이(병원 PC가 2주치를 올림).
const WEEKDAY = "일월화수목금토";
export const md = (date: string) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8))}(${WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]})`;

// done: 수술 계획에서 "완료"로 표시한 것. room·cancelled: 가져온 계획 메모의 YES 수술방(66·77·88·99 = 취소)
export type PlanItem = { id: string; date: string; name: string; procedure: string; done: boolean; room: string; cancelled: boolean };
export type ScheduleData = {
  lists: Map<string, { clinic: string; rows: OutpatientRow[] }>;
  plans: Map<string, PlanItem[]>;
  // surgeries = 취소 뺀 것(건수·내 주간 일정은 이것만), cancelled = 취소된 수술(화면에만 "취소"로)
  profs: Map<string, { doctor: string; outpatient: number; outpatientAm: number | null; outpatientPm: number | null; surgeries: ProfSurgery[]; cancelled: ProfSurgery[]; off: string | null }[]>;
};

const planSelect = {
  id: true,
  plannedDate: true,
  planData: true,
  planNote: true,
  status: true,
  patient: { select: { name: true } },
  surgeryType: { select: { code: true, name: true } },
} as const;

export function toPlanItem(
  p: {
    id: string;
    plannedDate: Date | null;
    planData: unknown;
    planNote?: string | null;
    status?: string;
    patient: { name: string };
    surgeryType: { code: string; name: string };
  },
  nameStyle: NameStyle,
): PlanItem {
  return {
    id: p.id,
    date: safeDateStr(p.plannedDate) ?? "",
    name: p.patient.name,
    procedure: procedureNameFor(p.surgeryType, parseFieldValues(p.planData), nameStyle),
    done: p.status === "DONE",
    room: roomLabel(planNoteRoom(p.planNote)),
    cancelled: isCancelledRoom(planNoteRoom(p.planNote)),
  };
}

// from~to(yyyy-MM-dd, 양끝 포함) 외래 명단과 수술 계획(완료 표시한 것도 — 지난 날짜에도 보이게)
export async function loadSchedule(userId: string, nameStyle: NameStyle, from: string, to: string): Promise<ScheduleData> {
  const [lists, plans, profRows] = await Promise.all([
    prisma.outpatientList.findMany({
      where: { createdById: userId, date: { gte: from, lte: to } },
      select: { date: true, clinic: true, rows: true },
    }),
    prisma.opPlan.findMany({
      where: { createdById: userId, plannedDate: { gte: new Date(from), lte: new Date(to) } },
      orderBy: { plannedDate: "asc" },
      select: planSelect,
    }),
    prisma.profSchedule.findMany({
      where: { createdById: userId, date: { gte: from, lte: to } },
      select: { date: true, doctor: true, outpatient: true, outpatientAm: true, outpatientPm: true, surgeries: true, off: true },
    }),
  ]);
  const order = (d: string) => PROFESSORS.indexOf(d as (typeof PROFESSORS)[number]);
  const profs = new Map<string, { doctor: string; outpatient: number; outpatientAm: number | null; outpatientPm: number | null; surgeries: ProfSurgery[]; cancelled: ProfSurgery[]; off: string | null }[]>();
  for (const r of [...profRows].sort((a, b) => order(a.doctor) - order(b.doctor))) {
    const { active, cancelled } = splitCancelled(parseProfSurgeries(r.surgeries));
    profs.set(r.date, [...(profs.get(r.date) ?? []), { doctor: r.doctor, outpatient: r.outpatient, outpatientAm: r.outpatientAm, outpatientPm: r.outpatientPm, surgeries: active, cancelled, off: r.off }]);
  }
  const byDate = new Map<string, PlanItem[]>();
  for (const p of plans) {
    const item = toPlanItem(p, nameStyle);
    byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  }
  return {
    lists: new Map(lists.map((l) => [l.date, { clinic: l.clinic, rows: l.rows as OutpatientRow[] }])),
    plans: byDate,
    profs,
  };
}

// date를 주면 환자 이름을 누를 때 진료 화면(/clinic — 로드맵·SOAP·오더)으로(사용자 2026-10-25)
export function OutpatientTable({ rows, date }: { rows: OutpatientRow[]; date?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{r.time}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap">
                {date && r.chartNo ? (
                  <Link href={`/clinic?date=${date}&chart=${r.chartNo}`} className="text-emerald-700 underline">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
              </td>
              <td className="py-1.5 pr-3 text-slate-500">{r.chartNo}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{r.visit}</td>
              <td className="py-1.5">{r.diagnosis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// YES 수술방 66·77·88·99 = 취소된 수술(사용자 2026-10-26)
function CancelBadge() {
  return <span className="ml-1.5 rounded bg-slate-200 px-1.5 text-xs text-slate-600 no-underline">취소</span>;
}

export function PlanList({ plans, showDate = true }: { plans: PlanItem[]; showDate?: boolean }) {
  return (
    <ul className="space-y-1 text-sm">
      {plans.map((p) => (
        <li key={p.id}>
          <Link href={`/plans/${p.id}`} className="hover:underline">
            {showDate && <span className="mr-2 font-medium">{md(p.date)}</span>}
            <span className={p.cancelled ? "text-slate-400 line-through" : ""}>{p.name}</span>
            <span className={`ml-2 ${p.cancelled ? "text-slate-400 line-through" : "text-slate-500"}`}>{p.procedure}</span>
            {p.room && <span className="ml-2 text-xs text-slate-400">{p.room}</span>}
            {p.cancelled && <CancelBadge />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ScheduleCalendar({
  dates,
  today,
  selected,
  data,
  dayHref,
}: {
  dates: string[];
  today: string;
  selected?: string;
  data: ScheduleData;
  dayHref: (date: string) => string;
}) {
  const lead = dates.length ? new Date(`${dates[0]}T00:00:00Z`).getUTCDay() : 0;
  const dayList = selected ? data.lists.get(selected) : undefined;
  const dayRows = dayList?.rows ?? [];
  const dayPlans = selected ? (data.plans.get(selected) ?? []) : [];
  const dayPlanCount = dayPlans.filter((p) => !p.cancelled).length;
  const dayProfs = selected ? (data.profs.get(selected) ?? []) : [];
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {[...WEEKDAY].map((d) => (
          <span key={d} className="py-1 text-slate-400">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {dates.map((date) => {
          const n = data.lists.get(date)?.rows.length ?? 0;
          const s = data.plans.get(date)?.filter((p) => !p.cancelled).length ?? 0;
          // 교수님별 "박 오전 수술 1"·"박 오후 외래 11"(사용자 2026-10-28, 예전 "박 1 · 문 1" 수술 수만)
          const ps = profCellLines(data.profs.get(date) ?? []);
          const tone =
            date === selected
              ? "border-slate-900 bg-slate-900 text-white"
              : n || s
                ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                : "border-slate-100 text-slate-400 hover:bg-slate-50";
          // 오늘은 테두리·"오늘" 글자로 더 눈에 띄게(사용자 2026-10-28)
          const isToday = date === today;
          return (
            <Link
              key={date}
              href={dayHref(date)}
              scroll={false}
              className={`flex min-h-14 flex-col items-center justify-start rounded-md border p-1 ${tone} ${isToday ? "ring-2 ring-emerald-600 ring-offset-1" : ""}`}
            >
              <span className={isToday ? "font-bold" : ""}>
                {Number(date.slice(8))}
                {isToday && <span className={`ml-0.5 rounded px-0.5 text-[10px] ${date === selected ? "bg-white text-slate-900" : "bg-emerald-600 text-white"}`}>오늘</span>}
              </span>
              {n > 0 && <span className="text-[10px]">외래 {n}</span>}
              {s > 0 && <span className="text-[10px]">수술 {s}</span>}
              {ps.map((line) => (
                <span key={line} title="교수님 외래·수술" className={`text-[10px] leading-tight break-keep ${date === selected ? "text-slate-300" : "text-slate-500"}`}>
                  {line}
                </span>
              ))}
            </Link>
          );
        })}
      </div>
      {selected && (
        <div id="day" className="mt-4 scroll-mt-24 space-y-3 border-t border-slate-100 pt-3">
          <p className="font-medium">{md(selected)}</p>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              외래 {dayRows.length}명{dayList?.clinic && ` · ${dayList.clinic}`}
              {dayRows.length > 0 && (
                <Link href={`/outpatient?date=${selected}`} className="ml-2 text-emerald-700 underline">
                  외래 명단에서 자세히
                </Link>
              )}
            </p>
            {dayRows.length ? <OutpatientTable rows={dayRows} date={selected} /> : <p className="text-sm text-slate-400">없음</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              수술 {dayPlanCount}건{dayPlans.length > dayPlanCount && ` · 취소 ${dayPlans.length - dayPlanCount}`}
            </p>
            {dayPlans.length ? <PlanList plans={dayPlans} showDate={false} /> : <p className="text-sm text-slate-400">없음</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">교수님 외래·수술</p>
            {dayProfs.length ? (
              <ul className="space-y-2 text-sm">
                {dayProfs.map((p) => (
                  <li key={p.doctor}>
                    <p>
                      <span className="font-medium">{p.doctor}</span>
                      {p.off && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">{offLabel(p.off)}</span>}
                      <span className="ml-2 text-slate-500">
                        외래 {p.outpatient}명
                        {(p.outpatientAm != null || p.outpatientPm != null) && `(오전 ${p.outpatientAm ?? 0} · 오후 ${p.outpatientPm ?? 0})`} · 수술 {p.surgeries.length}건{p.cancelled.length > 0 && ` · 취소 ${p.cancelled.length}`}
                      </span>
                    </p>
                    {p.surgeries.length + p.cancelled.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5 pl-3 text-slate-600">
                        {p.surgeries.map((op, i) => (
                          <li key={i}>
                            {op.half && <span className="mr-1.5 text-xs text-slate-400">{op.half}</span>}
                            {op.name} {op.age}/{op.sex} {op.chartNo} · {op.op}
                            {op.room && <span className="ml-1.5 text-xs text-slate-400">{roomLabel(op.room)}</span>}
                          </li>
                        ))}
                        {p.cancelled.map((op, i) => (
                          <li key={`c${i}`} className="text-slate-400">
                            <span className="line-through">
                              {op.name} {op.age}/{op.sex} {op.chartNo} · {op.op}
                            </span>
                            <span className="ml-1.5 text-xs">{roomLabel(op.room)}</span>
                            <CancelBadge />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">올라온 자료 없음(병원 PC가 평일 아침 2주치를 올림)</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
