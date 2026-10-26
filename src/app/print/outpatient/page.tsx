import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import type { OutpatientRow } from "@/lib/hospital-link";
import { safeDateStr } from "@/lib/date-format";
import { clinicOrder } from "@/lib/clinic-ask";
import { latestRoadmaps } from "@/lib/roadmap-store";
import { patientRoadmaps } from "@/lib/pathway-store";
import { buildPrintRow } from "@/lib/outpatient-print";
import { buttonStyles } from "@/lib/ui";
import { PrintButton } from "@/components/print-button";
import { AppNavBar } from "@/components/app-nav-bar";

// 외래 명단 인쇄(사용자 2026-10-26) — 외래 명단 화면의 "명단 인쇄"로 ?date=yyyy-MM-dd. A4 세로 표, 시간순.
// 종이에 남으니 이름은 기본으로 가운데를 가리고(?full=1이면 전체), 맨 위에 몇 시 기준 명단인지 크게 적는다
// (병원 PC가 평일 아침에 명단을 새로 고쳐서 전날 뽑은 종이엔 아침에 추가된 환자가 없을 수 있음). 본인 데이터만
const fmtTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export default async function OutpatientPrintPage({ searchParams }: PageProps<"/print/outpatient">) {
  const { userId } = await verifySession();
  const { date: dateParam, full } = await searchParams;
  const date = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const mask = full !== "1";

  const list = date
    ? await prisma.outpatientList.findUnique({
        where: { createdById_date: { createdById: userId, date } },
        select: { date: true, clinic: true, rows: true, updatedAt: true },
      })
    : null;
  const rows = clinicOrder((list?.rows ?? []) as OutpatientRow[]);
  const charts = rows.map((r) => r.chartNo).filter(Boolean);

  const [roadmaps, pathwayData, plans] = await Promise.all([
    latestRoadmaps(userId, charts),
    patientRoadmaps(userId, charts),
    charts.length
      ? prisma.opPlan.findMany({
          where: { createdById: userId, patient: { chartNo: { in: charts } } },
          select: { plannedDate: true, status: true, patient: { select: { chartNo: true } }, surgeryType: { select: { name: true } }, opRecord: { select: { operationDate: true } } },
        })
      : [],
  ]);

  const printRows = date
    ? rows.map((r) => {
        const rm = roadmaps.get(r.chartNo);
        const pw = pathwayData.get(r.chartNo) ?? { pathways: [], visits: [] };
        const surgeries = plans
          .filter((p) => p.patient.chartNo === r.chartNo)
          .flatMap((p) => {
            const d = safeDateStr(p.opRecord?.operationDate ?? p.plannedDate);
            return d ? [{ date: d, name: p.surgeryType.name, done: !!p.opRecord || p.status === "DONE" }] : [];
          });
        return buildPrintRow(
          { row: r, roadmapText: rm?.text ?? r.roadmap ?? "", done: rm?.done ?? [], pathways: pw.pathways, visits: pw.visits, surgeries },
          date,
          { mask },
        );
      })
    : [];

  const toggleHref = `/print/outpatient?date=${date ?? ""}${mask ? "&full=1" : ""}`;
  const wd = date ? WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()] : "";

  return (
    <div>
      <AppNavBar />
      <div className="mx-auto w-full max-w-3xl bg-white px-3 pt-4 pb-8 text-slate-900 sm:px-8 print:max-w-none print:p-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={date ? `/outpatient?date=${date}` : "/outpatient"} className={buttonStyles.link}>
              ← 외래 명단
            </Link>
            {date && (
              <Link href={toggleHref} className={buttonStyles.link}>
                {mask ? "이름 전체 보이기" : "이름 가리기"}
              </Link>
            )}
          </div>
          {printRows.length > 0 && <PrintButton />}
        </div>
        <p className="mb-4 text-xs text-slate-500 print:hidden">
          이름은 기본으로 가운데 글자를 가립니다. 할 일·지난 진료 요약은 AI가 정리한 참고용이고, 로드맵에서 체크한 할 일은 빠집니다.
          (인쇄 대화상자의 &ldquo;설정 더보기&rdquo;에서 &ldquo;머리글과 바닥글&rdquo;을 꺼두면 여백이 더 줄어듭니다.)
        </p>

        {!list ? (
          <p className="text-sm text-slate-400">{date ? `${date}에는 병원 PC가 올린 명단이 없습니다.` : "날짜가 없습니다. 외래 명단 화면에서 날짜를 고르고 인쇄하세요."}</p>
        ) : printRows.length === 0 ? (
          <p className="text-sm text-slate-400">이 날짜 명단에 환자가 없습니다.</p>
        ) : (
          <>
            <div className="mb-2 flex items-end justify-between border-b-2 border-slate-900 pb-1">
              <h1 className="text-lg font-bold">
                {date} ({wd}) {list.clinic} 외래 · {printRows.length}명
              </h1>
              <p className="text-sm font-semibold">{fmtTime.format(list.updatedAt)} 기준 명단</p>
            </div>
            <table className="w-full border-collapse text-[11px] leading-snug">
              <thead>
                <tr className="border-b border-slate-400 text-left text-slate-600">
                  <th className="w-5 py-1 pr-1 font-normal">#</th>
                  <th className="w-10 py-1 pr-2 font-normal">시간</th>
                  <th className="w-28 py-1 pr-2 font-normal">환자</th>
                  <th className="py-1 pr-2 font-normal">진단 · 오늘 할 것 · 할 일 · 지난 진료</th>
                  <th className="w-5 py-1 font-normal">✓</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((r, i) => (
                  <tr key={`${r.chartNo}-${i}`} className="break-inside-avoid border-b border-slate-300 align-top">
                    <td className="py-1 pr-1 text-slate-500">{i + 1}</td>
                    <td className="py-1 pr-2 font-semibold whitespace-nowrap">{r.time}</td>
                    <td className="py-1 pr-2">
                      <p className="text-[12px] font-semibold">
                        {r.name} <span className="font-normal text-slate-600">{r.sexAge}</span>
                      </p>
                      <p className="text-slate-600">{r.chartNo}</p>
                      <p className="text-slate-600">{r.visit}</p>
                    </td>
                    <td className="py-1 pr-2">
                      <p className="font-semibold">{r.diagnosis || "—"}</p>
                      {r.today.length > 0 && (
                        <p>
                          <span className="mr-1 rounded-sm bg-slate-900 px-1 text-[10px] text-white">오늘</span>
                          {r.today.join(" · ")}
                        </p>
                      )}
                      {r.todos.length > 0 && <p>{r.todos.map((t) => `□ ${t}`).join("  ")}</p>}
                      <p className="text-slate-600">
                        <span className="mr-1 text-[10px] text-slate-500">지난</span>
                        {r.last || "요약 없음"}
                      </p>
                    </td>
                    <td className="py-1">
                      <span className="inline-block h-3 w-3 border border-slate-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
