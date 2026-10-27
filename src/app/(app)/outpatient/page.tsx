import { Fragment } from "react";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, searchOutpatientHistory, type OutpatientRow } from "@/lib/hospital-link";
import { safeDateStr, seoulTodayAsStoredDate } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { clinicTabs, SectionTabs } from "@/components/section-tabs";
import { OutpatientCalendar } from "./outpatient-calendar";
import { RoadmapBox } from "./roadmap-box";
import { toggleTodo } from "@/app/actions/roadmap";
import { latestRoadmaps } from "@/lib/roadmap-store";
import { patientRoadmaps, type PatientPathwayView, type VisitSummaryView } from "@/lib/pathway-store";
import { PathwayView } from "./pathway-view";

// 진료 > 외래 명단 — 병원 PC가 올린 날짜별 명단(달력), 등록번호로 외래 이력 찾기, SOAP·로드맵(AI 정리).
// 예전 "병원 연동" 화면에 있던 것을 외래 메뉴로 옮겼다(사용자 2026-10-24). 본인 계정 데이터만(createdById).
const fmtTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});


// 외래 명단 행 아래 AI 정리 — SOAP(오늘 진료)와 로드맵(경과·현재·할 일·확인). 둘 다 참고용
// 로드맵은 환자별 최신 판(진료 후 갱신 포함, 할 일 체크 가능) — 없으면 명단 행에 붙은 것
type LatestRoadmap = { id: string; text: string; done: string[]; source: string; createdAt: Date };
type Care = { planType: string | null; nextVisit: string | null } | undefined;
const PLAN_LABEL: Record<string, string> = { surgery: "수술", medication: "약물치료", observation: "경과관찰", return: "회송" };
type PathwayData = { pathways: PatientPathwayView[]; visits: VisitSummaryView[] } | undefined;
function AiNotes({ row, rm, care, pw }: { row: OutpatientRow; rm?: LatestRoadmap; care?: Care; pw?: PathwayData }) {
  const careText = [care?.planType ? `Plan: ${PLAN_LABEL[care.planType] ?? care.planType}` : "", care?.nextVisit ? `다음 외래 ${care.nextVisit}` : ""].filter(Boolean).join(" · ");
  const box = "mt-1 whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-slate-700";
  const when = (d: Date) => d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
  return (
    <div className="space-y-1">
      {row.soap && (
        <details>
          <summary className="cursor-pointer text-emerald-700">SOAP (AI 요약, 참고용)</summary>
          <p className={box}>{row.soap}</p>
        </details>
      )}
      {(rm || row.roadmap || pw) && (
        <details>
          <summary className="cursor-pointer text-emerald-700">로드맵 (AI 정리, 참고용)</summary>
          {row.chartNo && <PathwayView chartNo={row.chartNo} pathways={pw?.pathways ?? []} visits={pw?.visits ?? []} />}
          {rm ? (
            <RoadmapBox
              text={rm.text}
              done={rm.done}
              meta={`${when(rm.createdAt)} ${rm.source === "visit" ? "진료 후 갱신" : "외래 전 정리"}${careText ? ` · ${careText}` : ""}`}
              toggle={toggleTodo.bind(null, rm.id)}
            />
          ) : (
            <p className={box}>{row.roadmap}</p>
          )}
        </details>
      )}
    </div>
  );
}

export default async function OutpatientPage({ searchParams }: PageProps<"/outpatient">) {
  const { userId } = await verifySession();
  const now = new Date();

  const { date: dateParam, month: monthParam, chart: chartParam } = await searchParams;
  const chartQuery = typeof chartParam === "string" ? chartParam.trim() : "";
  const dateStr = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;
  // 달력 달: ?month=yyyy-MM → 고른 날짜의 달 → 오늘이 있는 달
  const today = kstDate(now);
  const month =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : (dateStr ?? today).slice(0, 7);

  const lists = await prisma.outpatientList.findMany({
    where: { createdById: userId, date: { gte: `${month}-01`, lte: `${month}-31` } },
    orderBy: { date: "asc" },
    select: { date: true, clinic: true, rows: true, updatedAt: true },
  });

  // 등록번호로 외래 이력·SOAP 찾기 — 명단은 1년에 100개 남짓이라 다 읽어 거른다(일부 번호도 됨)
  const history = chartQuery
    ? searchOutpatientHistory(
        (
          await prisma.outpatientList.findMany({
            where: { createdById: userId },
            select: { date: true, clinic: true, rows: true },
          })
        ).map((l) => ({ ...l, rows: l.rows as OutpatientRow[] })),
        chartQuery,
      )
    : [];

  // 고른 날짜 → 없으면 오늘 이후 환자가 있는 가장 가까운 외래 → 그 달 마지막 외래.
  // 외래 당일(오늘)도 포함하고 0명인 날(격주 금요일 등)은 건너뛴다 — 예전엔 "내일 이후"라 외래 당일에 그날 명단이 안 보였음
  const hasRows = (l: { rows: unknown }) => (l.rows as OutpatientRow[]).length > 0;
  const selected =
    lists.find((l) => l.date === dateStr) ??
    (dateStr
      ? undefined
      : (lists.find((l) => l.date >= today && hasRows(l)) ?? lists.findLast(hasRows) ?? lists[lists.length - 1]));
  const rows = (selected?.rows ?? []) as OutpatientRow[];

  // 외래 환자 중 이 사이트에 있는 환자(등록번호)와 다가오는 수술 계획 — 바로 그 환자 화면으로 간다
  const chartNos = rows.map((r) => r.chartNo).filter(Boolean);
  const known = chartNos.length
    ? await prisma.patient.findMany({
        where: { createdById: userId, chartNo: { in: chartNos } },
        select: {
          id: true,
          chartNo: true,
          opPlans: {
            where: { createdById: userId, plannedDate: { gte: seoulTodayAsStoredDate() }, status: { not: "DONE" } },
            orderBy: { plannedDate: "asc" },
            take: 1,
            select: { id: true, plannedDate: true },
          },
        },
      })
    : [];
  const byChart = new Map(known.map((p) => [p.chartNo, p]));
  const careCharts = [...new Set([...chartNos, ...history.map((h) => h.row.chartNo)])];
  const [roadmaps, careRows, pathwayData] = await Promise.all([
    latestRoadmaps(userId, careCharts),
    prisma.patientCare.findMany({ where: { createdById: userId, chartNo: { in: careCharts } }, select: { chartNo: true, planType: true, nextVisit: true } }),
    patientRoadmaps(userId, careCharts),
  ]);
  const cares = new Map(careRows.map((r) => [r.chartNo, r]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">외래 진료 관리</h1>
      <SectionTabs tabs={clinicTabs(selected?.date ?? dateStr)} current="/outpatient" />

      <section className="space-y-3">
        <form className="flex max-w-sm gap-2">
          <input
            type="search"
            name="chart"
            inputMode="numeric"
            defaultValue={chartQuery}
            placeholder="등록번호(4자리 이상)로 외래 이력 찾기"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button type="submit" className={buttonStyles.secondarySmall}>
            검색
          </button>
        </form>
        {chartQuery && (
          <div className="space-y-2 rounded-md border border-slate-200 p-3 text-sm">
            <p className="text-slate-500">
              &ldquo;{chartQuery}&rdquo; 외래 이력 {history.length}건
              <Link href="/outpatient" className="ml-2 underline">
                지우기
              </Link>
            </p>
            {chartQuery.replace(/\D/g, "").length < 4 && <p className="text-amber-700">숫자 4자리 이상 넣어 주세요.</p>}
            {history.map((h, i) => (
              <div key={i} className="border-t border-slate-100 pt-2">
                <p>
                  <Link href={`/outpatient?date=${h.date}`} className="text-emerald-700 underline">
                    {h.date}
                  </Link>{" "}
                  {h.row.time} {h.row.name} {h.row.chartNo} ({h.row.visit}) {h.row.diagnosis}
                </p>
                {h.row.soap || h.row.roadmap || roadmaps.has(h.row.chartNo) || pathwayData.has(h.row.chartNo) ? <AiNotes row={h.row} rm={roadmaps.get(h.row.chartNo)} care={cares.get(h.row.chartNo)} pw={pathwayData.get(h.row.chartNo)} /> : <p className="text-slate-400">SOAP 없음</p>}
              </div>
            ))}
          </div>
        )}
        <OutpatientCalendar
          month={month}
          counts={Object.fromEntries(lists.map((l) => [l.date, (l.rows as OutpatientRow[]).length]))}
          selected={selected?.date}
          today={today}
        />
        {lists.length === 0 ? (
          <p className="text-sm text-slate-400">이 달에 병원 PC가 올린 명단이 없습니다.</p>
        ) : (
          <>
            {!selected && <p className="text-sm text-slate-400">이 날짜에는 명단이 없습니다.</p>}
            {selected && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">
                    {selected.date} {selected.clinic} · {rows.length}명 · {fmtTime.format(selected.updatedAt)} 갱신
                  </p>
                  {rows.length > 0 && (
                    <Link href={`/print/outpatient?date=${selected.date}`} className={buttonStyles.secondarySmall}>
                      명단 인쇄
                    </Link>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-3 font-normal whitespace-nowrap">시간</th>
                        <th className="py-2 pr-3 font-normal whitespace-nowrap">이름</th>
                        <th className="py-2 pr-3 font-normal whitespace-nowrap">등록번호</th>
                        <th className="py-2 pr-3 font-normal whitespace-nowrap">초재진</th>
                        <th className="py-2 pr-3 font-normal whitespace-nowrap">주진단</th>
                        <th className="py-2 font-normal whitespace-nowrap">이 사이트</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p, i) => {
                        const patient = byChart.get(p.chartNo);
                        const plan = patient?.opPlans[0];
                        return (
                          <Fragment key={i}>
                          <tr className={p.soap || p.roadmap || roadmaps.has(p.chartNo) || pathwayData.has(p.chartNo) ? "" : "border-b border-slate-100"}>
                            <td className="py-2 pr-3 whitespace-nowrap">{p.time}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">{p.name}</td>
                            <td className="py-2 pr-3">{p.chartNo}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">{p.visit}</td>
                            <td className="py-2 pr-3">{p.diagnosis}</td>
                            <td className="py-2 whitespace-nowrap">
                              {patient ? (
                                <span className="flex flex-wrap gap-2">
                                  <Link href={`/patients/${patient.id}`} className="text-emerald-700 underline">
                                    환자
                                  </Link>
                                  {plan && (
                                    <Link href={`/plans/${plan.id}`} className="text-emerald-700 underline">
                                      수술 {safeDateStr(plan.plannedDate)}
                                    </Link>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                          {(p.soap || p.roadmap || roadmaps.has(p.chartNo) || pathwayData.has(p.chartNo)) && (
                            <tr className="border-b border-slate-100">
                              <td colSpan={6} className="pb-2">
                                <AiNotes row={p} rm={roadmaps.get(p.chartNo)} care={cares.get(p.chartNo)} pw={pathwayData.get(p.chartNo)} />
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
