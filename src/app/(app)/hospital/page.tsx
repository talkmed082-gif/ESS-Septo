import { Fragment } from "react";
import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, PC_JOBS, pcJobState, type OutpatientRow } from "@/lib/hospital-link";
import { cancelTsaScan, requestTsaScan } from "@/app/actions/hospital-link";
import { safeDateStr, seoulTodayAsStoredDate } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { TsaScanForm } from "./tsa-scan-form";
import { OutpatientCalendar } from "./outpatient-calendar";

// 병원 PC 연동 상태 — 병원 PC 작업 상태판, TSA 구글 시트 동기화 기록·기간 확인 요청, 외래 명단.
// 로그인한 본인 계정 데이터만 보인다(createdById로 거름).
// dates: 비슷한 행(보류 이유)의 시트 수술일 — 날짜가 다르게 적힌 경우를 바로 알 수 있게
type SheetRef = { date: string; chart4: string; rows: number[]; dates?: string[] };

const fmtTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const STATE_STYLE = {
  ok: { text: "정상", cls: "bg-emerald-50 text-emerald-700" },
  late: { text: "늦음", cls: "bg-amber-50 text-amber-700" },
  fail: { text: "실패", cls: "bg-red-50 text-red-700" },
  none: { text: "기록 없음", cls: "bg-slate-100 text-slate-500" },
} as const;

// "TSA가 언제 수술일까지 시트에 반영됐나" — 실패 없이 끝난 실행 중 가장 늦은 끝 날짜
function TsaCoverage({ runs }: { runs: { rangeTo: string; createdAt: Date; error: string | null }[] }) {
  const ok = runs.filter((r) => !r.error);
  const latestTo = ok.reduce<string | null>((m, r) => (m === null || r.rangeTo > m ? r.rangeTo : m), null);
  const lastRun = runs[0];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-xs text-slate-500">시트에 반영된 마지막 수술일</p>
        <p className="text-xl font-semibold">{latestTo ?? "기록 없음"}</p>
      </div>
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-xs text-slate-500">마지막 확인</p>
        <p className="text-xl font-semibold">{lastRun ? fmtTime.format(lastRun.createdAt) : "기록 없음"}</p>
        {lastRun?.error && <p className="text-sm text-red-600">실패: {lastRun.error}</p>}
      </div>
    </div>
  );
}

function heldText(h: SheetRef) {
  const other = (h.dates ?? []).filter((d) => d !== h.date);
  return other.length
    ? `시트에는 ${other.join(", ")}로 있음 — 날짜 확인 필요(시트 ${h.rows.join(", ")}행)`
    : `비슷한 행이 있어 넣지 않음(시트 ${h.rows.join(", ")}행)`;
}

export default async function HospitalPage({ searchParams }: PageProps<"/hospital">) {
  const { userId } = await verifySession();
  const now = new Date();
  const tomorrow = kstDate(now, 1);

  const { date: dateParam, month: monthParam } = await searchParams;
  const dateStr = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;
  // 달력 달: ?month=yyyy-MM → 고른 날짜의 달 → 내일(다음 외래)이 있는 달
  const month =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : (dateStr ?? tomorrow).slice(0, 7);

  const [user, runs, lists, jobs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { tsaScanFrom: true, tsaScanTo: true, tsaScanRequestedAt: true },
    }),
    prisma.tsaRun.findMany({ where: { createdById: userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.outpatientList.findMany({
      where: { createdById: userId, date: { gte: `${month}-01`, lte: `${month}-31` } },
      orderBy: { date: "asc" },
      select: { date: true, clinic: true, rows: true, updatedAt: true },
    }),
    prisma.pcJobStatus.findMany({ where: { createdById: userId } }),
  ]);

  // 고른 날짜 → 없으면 내일 이후 가장 가까운 외래 → 그 달 마지막 외래
  const selected =
    lists.find((l) => l.date === dateStr) ??
    (dateStr ? undefined : (lists.find((l) => l.date >= tomorrow) ?? lists[lists.length - 1]));
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
  const jobByKey = new Map(jobs.map((j) => [j.job, j]));

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold">병원 연동</h1>

      <section className="space-y-3">
        <h2 className="font-medium">병원 PC 작업</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-normal">작업</th>
                <th className="py-2 pr-3 font-normal">상태</th>
                <th className="py-2 pr-3 font-normal">마지막 실행</th>
                <th className="py-2 font-normal">내용</th>
              </tr>
            </thead>
            <tbody>
              {PC_JOBS.map((def) => {
                const s = jobByKey.get(def.key);
                const state = STATE_STYLE[pcJobState(s, def.maxAgeHours, now)];
                return (
                  <tr key={def.key} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{def.label}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${state.cls}`}>{state.text}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{s ? fmtTime.format(s.lastRunAt) : "-"}</td>
                    <td className="py-2">
                      {s?.lastMessage && <p className={s.lastOk ? "text-slate-600" : "text-red-600"}>{s.lastMessage}</p>}
                      {s?.lastOk && s.lastFailureAt && (
                        <p className="text-xs text-slate-400">
                          마지막 실패 {fmtTime.format(s.lastFailureAt)}: {s.lastFailure}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">TSA 구글 시트</h2>
        <TsaCoverage runs={runs} />
        <p className="text-sm text-slate-500">
          평일 17시에 다음 날 수술장 명단의 TSA를 시트에 넣습니다. 응급·주말 수술은 아래에서 기간을 정해 확인을
          요청하세요. 병원 PC가 평일 8시~20시 사이 10분마다 확인해 처리합니다. 끝 날짜는 내일까지만 됩니다.
        </p>
        {user?.tsaScanRequestedAt ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <span>
              요청됨: {user.tsaScanFrom} ~ {user.tsaScanTo} ({fmtTime.format(user.tsaScanRequestedAt)}에 요청, 처리 대기)
            </span>
            <form action={cancelTsaScan}>
              <button type="submit" className={buttonStyles.smallOutline}>
                요청 취소
              </button>
            </form>
          </div>
        ) : (
          <TsaScanForm action={requestTsaScan} defaultFrom={kstDate(now, -7)} tomorrow={tomorrow} />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-normal">실행</th>
                <th className="py-2 pr-3 font-normal">종류·기간</th>
                <th className="py-2 pr-3 font-normal">TSA</th>
                <th className="py-2 pr-3 font-normal">추가</th>
                <th className="py-2 pr-3 font-normal">이미 있음</th>
                <th className="py-2 font-normal">확인 필요</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-slate-400">
                    아직 기록이 없습니다.
                  </td>
                </tr>
              )}
              {runs.map((r) => {
                const held = r.held as SheetRef[];
                const dups = r.dups as SheetRef[];
                return (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtTime.format(r.createdAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.kind === "RANGE" ? "기간 확인" : "일일"} {r.rangeFrom === r.rangeTo ? r.rangeFrom : `${r.rangeFrom}~${r.rangeTo}`}
                    </td>
                    <td className="py-2 pr-3">{r.found}</td>
                    <td className="py-2 pr-3">{r.added}</td>
                    <td className="py-2 pr-3">{r.skipped}</td>
                    <td className="py-2">
                      {r.error && <p className="text-red-600">실패: {r.error}</p>}
                      {held.map((h, i) => (
                        <p key={`h${i}`} className="text-amber-700">
                          {h.date} …{h.chart4}: {heldText(h)}
                        </p>
                      ))}
                      {dups.map((d, i) => (
                        <p key={`d${i}`} className="text-amber-700">
                          {d.date} …{d.chart4}: 같은 환자 중복 의심(시트 {d.rows.join(", ")}행)
                        </p>
                      ))}
                      {!r.error && held.length === 0 && dups.length === 0 && <span className="text-slate-400">없음</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">외래 명단</h2>
        <OutpatientCalendar
          month={month}
          counts={Object.fromEntries(lists.map((l) => [l.date, (l.rows as OutpatientRow[]).length]))}
          selected={selected?.date}
          today={kstDate(now)}
        />
        {lists.length === 0 ? (
          <p className="text-sm text-slate-400">이 달에 병원 PC가 올린 명단이 없습니다.</p>
        ) : (
          <>
            {!selected && <p className="text-sm text-slate-400">이 날짜에는 명단이 없습니다.</p>}
            {selected && (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">
                  {selected.date} {selected.clinic} · {rows.length}명 · {fmtTime.format(selected.updatedAt)} 갱신
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-3 font-normal">시간</th>
                        <th className="py-2 pr-3 font-normal">이름</th>
                        <th className="py-2 pr-3 font-normal">등록번호</th>
                        <th className="py-2 pr-3 font-normal">초재진</th>
                        <th className="py-2 pr-3 font-normal">주진단</th>
                        <th className="py-2 font-normal">이 사이트</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p, i) => {
                        const patient = byChart.get(p.chartNo);
                        const plan = patient?.opPlans[0];
                        return (
                          <Fragment key={i}>
                          <tr className={p.soap ? "" : "border-b border-slate-100"}>
                            <td className="py-2 pr-3 whitespace-nowrap">{p.time}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">{p.name}</td>
                            <td className="py-2 pr-3">{p.chartNo}</td>
                            <td className="py-2 pr-3">{p.visit}</td>
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
                          {p.soap && (
                            <tr className="border-b border-slate-100">
                              <td colSpan={6} className="pb-2">
                                <details>
                                  <summary className="cursor-pointer text-emerald-700">SOAP (AI 요약, 참고용)</summary>
                                  <p className="mt-1 whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-slate-700">{p.soap}</p>
                                </details>
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
