import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { type OutpatientRow } from "@/lib/hospital-link";
import { parseFieldValues } from "@/lib/field-types";
import { procedureNameFor, type NameStyle } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { parseProfSurgeries, PROFESSORS, type ProfSurgery } from "@/lib/prof-schedule";
import { profSurgeryTags } from "@/lib/my-week";

// 내 일정 달력(외래 인원·수술) — 대시보드 2주 달력과 캘린더 메뉴(한 달)가 같이 쓴다(사용자 2026-10-25).
// 날짜를 누르면 그날 외래·수술 환자 목록이 아래에 뜬다. 교수님 4분 외래 인원·수술도 같이(병원 PC가 2주치를 올림).
const WEEKDAY = "일월화수목금토";
export const md = (date: string) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8))}(${WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]})`;

// done: 수술 계획에서 "완료"로 표시한 것
export type PlanItem = { id: string; date: string; name: string; procedure: string; done: boolean };
export type ScheduleData = {
  lists: Map<string, { clinic: string; rows: OutpatientRow[] }>;
  plans: Map<string, PlanItem[]>;
  profs: Map<string, { doctor: string; outpatient: number; surgeries: ProfSurgery[] }[]>;
};

const planSelect = {
  id: true,
  plannedDate: true,
  planData: true,
  status: true,
  patient: { select: { name: true } },
  surgeryType: { select: { code: true, name: true } },
} as const;

export function toPlanItem(
  p: {
    id: string;
    plannedDate: Date | null;
    planData: unknown;
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
      select: { date: true, doctor: true, outpatient: true, surgeries: true },
    }),
  ]);
  const order = (d: string) => PROFESSORS.indexOf(d as (typeof PROFESSORS)[number]);
  const profs = new Map<string, { doctor: string; outpatient: number; surgeries: ProfSurgery[] }[]>();
  for (const r of [...profRows].sort((a, b) => order(a.doctor) - order(b.doctor))) {
    profs.set(r.date, [...(profs.get(r.date) ?? []), { doctor: r.doctor, outpatient: r.outpatient, surgeries: parseProfSurgeries(r.surgeries) }]);
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

export function OutpatientTable({ rows }: { rows: OutpatientRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{r.time}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap">{r.name}</td>
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

export function PlanList({ plans, showDate = true }: { plans: PlanItem[]; showDate?: boolean }) {
  return (
    <ul className="space-y-1 text-sm">
      {plans.map((p) => (
        <li key={p.id}>
          <Link href={`/plans/${p.id}`} className="hover:underline">
            {showDate && <span className="mr-2 font-medium">{md(p.date)}</span>}
            <span>{p.name}</span>
            <span className="ml-2 text-slate-500">{p.procedure}</span>
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
          const s = data.plans.get(date)?.length ?? 0;
          // 교수님별 수술 수 "박 1 · 문 1"(사용자 2026-10-25, 예전 "교수 3" 합계 대신)
          const ps = profSurgeryTags(data.profs.get(date) ?? []);
          const tone =
            date === selected
              ? "border-slate-900 bg-slate-900 text-white"
              : n || s
                ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                : "border-slate-100 text-slate-400 hover:bg-slate-50";
          return (
            <Link
              key={date}
              href={dayHref(date)}
              scroll={false}
              className={`flex min-h-14 flex-col items-center justify-start rounded-md border p-1 ${tone}`}
            >
              <span className={date === today ? "font-semibold underline" : ""}>{Number(date.slice(8))}</span>
              {n > 0 && <span className="text-[10px]">외래 {n}</span>}
              {s > 0 && <span className="text-[10px]">수술 {s}</span>}
              {ps && <span title="교수님 수술" className={`text-[10px] leading-tight ${date === selected ? "text-slate-300" : "text-slate-500"}`}>{ps}</span>}
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
            {dayRows.length ? <OutpatientTable rows={dayRows} /> : <p className="text-sm text-slate-400">없음</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">수술 {dayPlans.length}건</p>
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
                      <span className="ml-2 text-slate-500">
                        외래 {p.outpatient}명 · 수술 {p.surgeries.length}건
                      </span>
                    </p>
                    {p.surgeries.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5 pl-3 text-slate-600">
                        {p.surgeries.map((op, i) => (
                          <li key={i}>
                            {op.name} {op.age}/{op.sex} {op.chartNo} · {op.op}
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
