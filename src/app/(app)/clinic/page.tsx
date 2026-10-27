import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { safeDateStr } from "@/lib/date-format";
import { clinicTabs, SectionTabs } from "@/components/section-tabs";
import { latestRoadmaps } from "@/lib/roadmap-store";
import { patientRoadmaps } from "@/lib/pathway-store";
import { summaryLine } from "@/lib/pathways";
import { inferStage, parseRoadmap, parseSoap, type SurgeryFact } from "@/lib/clinic-view";
import { clinicDefaults, jobWhere } from "@/lib/opd-jobs";
import { ClinicDetail } from "./clinic-detail";
import { ClinicList } from "./clinic-list";
import { LaptopNow, type LaptopNowView } from "./laptop-now";
import { ListRefresh } from "./list-refresh";

// 진료 화면 — 왼쪽 외래 명단, 오른쪽 고른 환자의 로드맵(도형·지금 단계 판정)·SOAP·오늘 오더(진료실 PC로 보내기).
// EMR에 이미 있는 것(이전 기록 전문)은 두지 않고, EMR에 없는 것만 모은다(사용자 2026-10-25). 본인 데이터만
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default async function ClinicPage({ searchParams }: PageProps<"/clinic">) {
  const { userId } = await verifySession();
  const { date: dateParam, chart: chartParam } = await searchParams;
  const today = kstDate(new Date());
  const asked = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  // 날짜: 고른 날 → 오늘 이후 환자가 있는 가장 가까운 외래 → 마지막 외래
  const sel = { date: true, clinic: true, rows: true, updatedAt: true } as const;
  const list = asked
    ? await prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: userId, date: asked } }, select: sel })
    : ((await prisma.outpatientList.findMany({ where: { createdById: userId, date: { gte: today } }, orderBy: { date: "asc" }, take: 14, select: sel })).find(
        (l) => (l.rows as OutpatientRow[]).length > 0,
      ) ?? (await prisma.outpatientList.findFirst({ where: { createdById: userId }, orderBy: { date: "desc" }, select: sel })));
  const date = asked ?? list?.date ?? today;
  const rows = (list?.rows ?? []) as OutpatientRow[];
  const chart = typeof chartParam === "string" && rows.some((r) => r.chartNo === chartParam) ? chartParam : rows[0]?.chartNo;
  const row = rows.find((r) => r.chartNo === chart);

  const [jobs, templates, me] = await Promise.all([
    prisma.opdJob.findMany({ where: { createdById: userId, visitDate: date }, select: { id: true, chartNo: true, status: true, result: true, tasks: true, practice: true, updatedAt: true } }),
    prisma.outpatientTemplate.findMany({ where: { createdById: userId }, orderBy: [{ audience: "asc" }, { sortOrder: "asc" }], select: { id: true, title: true, audience: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { clinicSendDefaults: true, outpatientRefreshDate: true, outpatientRefreshAt: true } }),
  ]);
  const defaults = clinicDefaults(me?.clinicSendDefaults);
  // [노트북 지금] — 처리 중인 노트북 일감(어느 날짜든 오늘 이후)과 고른 날짜의 노트북 일감 건수
  const runningJob = await prisma.opdJob.findFirst({
    where: { createdById: userId, status: "running", visitDate: { gte: today } },
    orderBy: { updatedAt: "desc" },
    select: { chartNo: true, name: true, visit: true, visitDate: true, result: true, updatedAt: true, tasks: true },
  });
  const laptopJobs = jobs.filter((j) => jobWhere(j.tasks) === "laptop");
  const countOf = (s: string) => laptopJobs.filter((j) => j.status === s).length;
  const laptopNow: LaptopNowView = {
    running:
      runningJob && jobWhere(runningJob.tasks) === "laptop"
        ? {
            time: runningJob.visitDate === date ? (rows.find((r) => r.chartNo === runningJob.chartNo)?.time ?? "") : "",
            name: runningJob.name,
            visit: runningJob.visit,
            visitDate: runningJob.visitDate,
            step: runningJob.result ?? "",
            updatedAt: runningJob.updatedAt.toISOString(),
          }
        : null,
    counts: { pending: countOf("pending"), waiting: countOf("waiting"), done: countOf("done"), failed: countOf("failed") },
    date,
  };
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
        patientId={plans[0]?.patientId ?? (await prisma.patient.findFirst({ where: { createdById: userId, chartNo: chart }, select: { id: true } }))?.id ?? null}
        nextPlan={next ? { id: next.id, date: next.date } : null}
        pathways={pw.pathways}
        visits={pw.visits}
        calls={Object.fromEntries(pw.pathways.map((pp) => [pp.pathwayId, inferStage(pp, surgeries, date, pw.pathways.length)]))}
        templates={templates}
        job={j ? { id: j.id, status: j.status, result: j.result, where: jobWhere(j.tasks), practice: j.practice, updatedAt: j.updatedAt.toISOString() } : null}
        defaults={defaults}
        date={date}
        canSend={date >= today}
      />
    );
  }

  return (
    // 넓은 화면(lg)에서만 본문 폭을 넘어 넓게 쓴다 — 폰에서는 100vw 계산이 화면 밖으로 밀려 오른쪽이 잘렸다(사용자 2026-10-26 캡처)
    <div className="space-y-4 lg:relative lg:left-1/2 lg:w-[min(1600px,calc(100vw-2rem))] lg:-translate-x-1/2">
      <div>
        <SectionTabs tabs={clinicTabs(date)} current="/clinic" />
        {/* 외래 진행 중 = 진료 화면 + 진료 브리핑(폰에 띄워 두는 화면, 사용자 2026-10-27 "진료 브리핑과 통합") */}
        <p className="-mt-4 mb-2 text-sm">
          <Link href={`/m?date=${date}`} className="text-emerald-700 underline">
            진료 브리핑(폰 화면) 열기
          </Link>
        </p>
      </div>
      {/* 폰(한 칸)에서도 칸 폭을 화면에 묶는다 — 기본 grid 칸은 내용 폭(413px)만큼 넓어져 오른쪽이 잘렸다 */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-2">
          <LaptopNow view={laptopNow} />
          <div className="flex items-center gap-1">
            <Link href={`/clinic?date=${addDays(date, -1)}`} className="rounded border border-slate-300 px-2 py-1 text-sm" aria-label="전날">
              ‹
            </Link>
            <form className="flex min-w-0 flex-1 gap-1">
              <input type="date" name="date" defaultValue={date} className="w-full min-w-0 rounded border border-slate-300 px-2 py-1 text-sm" />
              <button type="submit" className="shrink-0 whitespace-nowrap rounded border border-slate-300 px-2 text-sm">
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
          <ListRefresh
            date={date}
            canEmr={date >= today}
            updatedAt={list && "updatedAt" in list && list.date === date ? list.updatedAt.toISOString() : null}
            requested={!!me?.outpatientRefreshAt && me.outpatientRefreshDate === date}
          />
          {/* 기록지 미리 저장(노트북 보내기)은 외래 전 준비로 옮겼다(사용자 2026-10-27) — 여기는 명단만 */}
          <ClinicList
            key={date}
            date={date}
            chart={chart}
            templates={templates}
            defaults={defaults}
            canSend={false}
            rows={rows.map((r) => ({ time: r.time, name: r.name, chartNo: r.chartNo, visit: r.visit, diagnosis: r.diagnosis, job: jobByChart.get(r.chartNo)?.status ?? null }))}
          />
        </aside>
        <div className="min-w-0">{detail}</div>
      </div>
    </div>
  );
}
