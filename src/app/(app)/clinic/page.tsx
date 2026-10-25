import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { safeDateStr } from "@/lib/date-format";
import { OUTPATIENT_TABS, SectionTabs } from "@/components/section-tabs";
import { latestRoadmaps } from "@/lib/roadmap-store";
import { patientRoadmaps } from "@/lib/pathway-store";
import { summaryLine } from "@/lib/pathways";
import { inferStage, parseRoadmap, parseSoap, type SurgeryFact } from "@/lib/clinic-view";
import { jobWhere } from "@/lib/opd-jobs";
import { ClinicDetail, VISIT_CLS } from "./clinic-detail";
import { BatchPanel } from "./batch-panel";

// 진료 화면 — 왼쪽 외래 명단, 오른쪽 고른 환자의 로드맵(도형·지금 단계 판정)·SOAP·오늘 오더(진료실 PC로 보내기).
// EMR에 이미 있는 것(이전 기록 전문)은 두지 않고, EMR에 없는 것만 모은다(사용자 2026-10-25). 본인 데이터만
const JOB_DOT: Record<string, string> = { pending: "bg-sky-500", running: "bg-sky-500", waiting: "bg-amber-500", done: "bg-emerald-500", failed: "bg-red-500" };
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default async function ClinicPage({ searchParams }: PageProps<"/clinic">) {
  const { userId } = await verifySession();
  const { date: dateParam, chart: chartParam } = await searchParams;
  const today = kstDate(new Date());
  const asked = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  // 날짜: 고른 날 → 오늘 이후 환자가 있는 가장 가까운 외래 → 마지막 외래
  const sel = { date: true, clinic: true, rows: true } as const;
  const list = asked
    ? await prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: userId, date: asked } }, select: sel })
    : ((await prisma.outpatientList.findMany({ where: { createdById: userId, date: { gte: today } }, orderBy: { date: "asc" }, take: 14, select: sel })).find(
        (l) => (l.rows as OutpatientRow[]).length > 0,
      ) ?? (await prisma.outpatientList.findFirst({ where: { createdById: userId }, orderBy: { date: "desc" }, select: sel })));
  const date = asked ?? list?.date ?? today;
  const rows = (list?.rows ?? []) as OutpatientRow[];
  const chart = typeof chartParam === "string" && rows.some((r) => r.chartNo === chartParam) ? chartParam : rows[0]?.chartNo;
  const row = rows.find((r) => r.chartNo === chart);

  const [jobs, templates] = await Promise.all([
    prisma.opdJob.findMany({ where: { createdById: userId, visitDate: date }, select: { id: true, chartNo: true, status: true, result: true, tasks: true, practice: true, updatedAt: true } }),
    prisma.outpatientTemplate.findMany({ where: { createdById: userId }, orderBy: [{ audience: "asc" }, { sortOrder: "asc" }], select: { id: true, title: true, audience: true } }),
  ]);
  const jobByChart = new Map(jobs.map((j) => [j.chartNo, j]));

  let detail: React.ReactNode = <p className="text-sm text-slate-400">이 날짜에 명단이 없습니다.</p>;
  if (row && chart) {
    const [roadmaps, pathwayData, care, plans] = await Promise.all([
      latestRoadmaps(userId, [chart]),
      patientRoadmaps(userId, [chart]),
      prisma.patientCare.findUnique({ where: { createdById_chartNo: { createdById: userId, chartNo: chart } }, select: { planType: true, nextVisit: true } }),
      prisma.opPlan.findMany({
        where: { createdById: userId, patient: { chartNo: chart } },
        select: { id: true, plannedDate: true, status: true, patientId: true, surgeryType: { select: { name: true, code: true } }, opRecord: { select: { operationDate: true } } },
      }),
    ]);
    const rm = roadmaps.get(chart);
    const pw = pathwayData.get(chart) ?? { pathways: [], visits: [] };
    // 이 사이트의 수술 기록(날짜)·수술 계획 → 지금 단계 판정의 근거
    const surgeries: SurgeryFact[] = plans.flatMap((p) => {
      const d = safeDateStr(p.opRecord?.operationDate ?? p.plannedDate);
      return d ? [{ date: d, name: `${p.surgeryType.name} ${p.surgeryType.code}`.trim(), done: !!p.opRecord || p.status === "DONE" }] : [];
    });
    const roadmapText = rm?.text ?? row.roadmap ?? "";
    const rp = parseRoadmap(roadmapText);
    const next = plans
      .map((p) => ({ id: p.id, date: safeDateStr(p.plannedDate) ?? "", open: !p.opRecord && p.status !== "DONE" }))
      .filter((p) => p.open && p.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const j = jobByChart.get(chart);
    detail = (
      <ClinicDetail
        row={row}
        summary={summaryLine(roadmapText) ?? (rp.summary || null)}
        soap={parseSoap(row.soap)}
        roadmap={rp}
        roadmapVersion={rm ? { id: rm.id, done: rm.done } : null}
        care={care}
        patientId={plans[0]?.patientId ?? null}
        nextPlan={next ? { id: next.id, date: next.date } : null}
        pathways={pw.pathways}
        visits={pw.visits}
        calls={Object.fromEntries(pw.pathways.map((pp) => [pp.pathwayId, inferStage(pp, surgeries, date, pw.pathways.length)]))}
        templates={templates}
        job={j ? { id: j.id, status: j.status, result: j.result, where: jobWhere(j.tasks), practice: j.practice, updatedAt: j.updatedAt.toISOString() } : null}
        date={date}
        canSend={date >= today}
      />
    );
  }

  return (
    <div className="relative left-1/2 w-[min(1600px,calc(100vw-2rem))] -translate-x-1/2 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">진료</h1>
        <SectionTabs tabs={OUTPATIENT_TABS} current="/clinic" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <div className="flex items-center gap-1">
            <Link href={`/clinic?date=${addDays(date, -1)}`} className="rounded border border-slate-300 px-2 py-1 text-sm" aria-label="전날">
              ‹
            </Link>
            <form className="flex flex-1 gap-1">
              <input type="date" name="date" defaultValue={date} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
              <button type="submit" className="rounded border border-slate-300 px-2 text-sm">
                보기
              </button>
            </form>
            <Link href={`/clinic?date=${addDays(date, 1)}`} className="rounded border border-slate-300 px-2 py-1 text-sm" aria-label="다음 날">
              ›
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            {date}
            {date === today ? " (오늘)" : ""} {list?.clinic ?? ""} · {rows.length}명
          </p>
          {date >= today && rows.length > 0 && (
            <BatchPanel
              key={date}
              date={date}
              templates={templates}
              rows={rows.map((r) => {
                const j = jobByChart.get(r.chartNo);
                return { time: r.time, name: r.name, chartNo: r.chartNo, visit: r.visit, diagnosis: r.diagnosis, sent: !!j && j.status !== "cancelled" };
              })}
            />
          )}
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white lg:max-h-[calc(100vh-12rem)]">
            {rows.map((r) => {
              const jb = jobByChart.get(r.chartNo);
              return (
                <li key={r.chartNo}>
                  <Link href={`/clinic?date=${date}&chart=${r.chartNo}`} className={`flex items-center gap-2 px-3 py-2 text-sm ${r.chartNo === chart ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                    <span className="w-11 shrink-0 text-xs text-slate-500">{r.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-slate-500">{r.diagnosis}</span>
                    </span>
                    <span className={`shrink-0 rounded px-1 text-[11px] ${VISIT_CLS[r.visit] ?? "bg-slate-100"}`}>{r.visit}</span>
                    {jb && <span title={jb.status} className={`h-2 w-2 shrink-0 rounded-full ${JOB_DOT[jb.status] ?? "bg-slate-300"}`} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
        <div className="min-w-0">{detail}</div>
      </div>
    </div>
  );
}
