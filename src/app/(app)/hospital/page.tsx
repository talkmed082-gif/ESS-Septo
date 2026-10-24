import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, PC_JOBS, pcJobState } from "@/lib/hospital-link";
import { SETTINGS_TABS, SectionTabs } from "@/components/section-tabs";
import { AutomationPauseCard } from "../settings/automation-pause-card";
import { ImportTokenCard } from "../settings/import-token-card";

// 설정 > 병원 연동 — 병원 PC 작업 상태판, 자동화 쉬는 날, EMR 수술 일정 연동 토큰.
// 외래 명단은 외래, TSA 시트는 수술 메뉴로 옮겼다(사용자 2026-10-24). 본인 계정 데이터만(createdById).
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

export default async function HospitalPage({ searchParams }: PageProps<"/hospital">) {
  // 예전 외래 명단 주소(/hospital?date=… 등, 텔레그램·즐겨찾기)는 외래 화면으로 넘긴다
  const params = await searchParams;
  const old = new URLSearchParams();
  for (const k of ["date", "month", "chart"]) {
    const v = params[k];
    if (typeof v === "string") old.set(k, v);
  }
  if (old.size) redirect(`/outpatient?${old}`);

  const { userId } = await verifySession();
  const now = new Date();
  const today = kstDate(now);
  const [jobs, pauses, user] = await Promise.all([
    prisma.pcJobStatus.findMany({ where: { createdById: userId } }),
    // 자동화 쉬는 날 — 끝나지 않은 기간만(서울 오늘 기준)
    prisma.automationPause.findMany({
      where: { createdById: userId, to: { gte: today } },
      orderBy: { from: "asc" },
      select: { id: true, from: true, to: true, note: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { importToken: true } }),
  ]);
  const jobByKey = new Map(jobs.map((j) => [j.job, j]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">설정</h1>
        <SectionTabs tabs={SETTINGS_TABS} current="/hospital" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">병원 PC 작업</h2>
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

      <div className="max-w-lg">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">병원 PC 자동화 쉬는 날</h2>
        <AutomationPauseCard pauses={pauses} today={today} />
      </div>

      <div className="max-w-lg">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">EMR 수술 일정 연동</h2>
        <ImportTokenCard token={user?.importToken ?? null} />
      </div>
    </div>
  );
}
