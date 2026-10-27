import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { procedureNameFor, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { kstDate } from "@/lib/hospital-link";
import { cancelTsaScan, requestTsaScan } from "@/app/actions/hospital-link";
import { safeDateStr, seoulTodayAsStoredDate } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { SETTINGS_TABS, SectionTabs } from "@/components/section-tabs";
import { TsaScanForm } from "./tsa-scan-form";
import { SurgerySettings } from "./surgery-settings";

// 수술 — 다가오는 수술(예전 환자 목록 위), 빈 체크리스트 인쇄, TSA 구글 시트(예전 병원 연동).
// 사용자 2026-10-24 메뉴 개편으로 한곳에 모았다. 본인 계정 데이터만(createdById).
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

export default async function SurgeryPage() {
  const user = await getCurrentUser();
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };
  const now = new Date();
  const tomorrow = kstDate(now, 1);
  // 한국 시간 기준 오늘 — UTC로 자르면 오전 9시 전까지 어제 수술도 "다가오는 수술"에 남았다.
  const todayUtc = seoulTodayAsStoredDate();

  const [upcomingPlans, tsaUser, runs] = await Promise.all([
    prisma.opPlan.findMany({
      // "완료"로 표시해둔 계획은 기록지를 아직 안 썼어도 더 이상 "다가오는 수술"이 아니므로 제외한다.
      where: { createdById: user.id, plannedDate: { gte: todayUtc }, opRecord: null, status: { not: "DONE" } },
      orderBy: { plannedDate: "asc" },
      select: {
        id: true,
        plannedDate: true,
        planData: true,
        patient: { select: { name: true } },
        surgeryType: { select: { code: true, name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { tsaScanFrom: true, tsaScanTo: true, tsaScanRequestedAt: true },
    }),
    prisma.tsaRun.findMany({ where: { createdById: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="space-y-8">
      {/* 설정의 한 탭(사용자 2026-10-26 — 상단 메뉴 "수술"을 설정으로) */}
      <div>
        <h1 className="mb-4 text-xl font-semibold">설정</h1>
        <SectionTabs tabs={SETTINGS_TABS} current="/surgery" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">수술</h2>
        {/* "선택한 환자 Op Plan 인쇄"(환자 목록에서 체크한 환자로 채워서 인쇄)와 헷갈리지 않도록 "빈"을 명시한다. */}
        <Link href="/print/fess-checklist" className={buttonStyles.secondarySmall}>
          빈 체크리스트 양식 인쇄
        </Link>
      </div>

      {upcomingPlans.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-emerald-900">
            다가오는 수술 ({upcomingPlans.length}건)
          </h2>
          <ul className="space-y-2">
            {upcomingPlans.map((plan) => {
              const values = parseFieldValues(plan.planData);
              const procedureName = procedureNameFor(plan.surgeryType, values, nameStyle);
              return (
                <li key={plan.id} className="flex items-center justify-between text-sm">
                  <Link href={`/plans/${plan.id}`} className="hover:underline">
                    <span className="font-medium text-slate-900">
                      {safeDateStr(plan.plannedDate)}
                    </span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="text-slate-900">{plan.patient.name}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="text-slate-600">{procedureName}</span>
                  </Link>
                  <Link
                    href={`/plans/${plan.id}?view=post`}
                    className={`shrink-0 ${buttonStyles.smallOutlineAccent}`}
                  >
                    기록지 작성
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {upcomingPlans.length === 0 && (
        <p className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-400">다가오는 수술이 없습니다.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">TSA 구글 시트</h2>
        <TsaCoverage runs={runs} />
        <p className="text-sm text-slate-500">
          평일 17시에 다음 날 수술장 명단의 TSA를 시트에 넣습니다. 응급·주말 수술은 아래에서 기간을 정해 확인을
          요청하세요. 병원 PC가 평일 8시~20시 사이 10분마다 확인해 처리합니다. 끝 날짜는 내일까지만 됩니다.
        </p>
        {tsaUser?.tsaScanRequestedAt ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <span>
              요청됨: {tsaUser.tsaScanFrom} ~ {tsaUser.tsaScanTo} ({fmtTime.format(tsaUser.tsaScanRequestedAt)}에 요청, 처리 대기)
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

      {/* 예전 설정 > 일반에 있던 수술 관련 설정(2026-10-27) */}
      <SurgerySettings />
    </div>
  );
}
