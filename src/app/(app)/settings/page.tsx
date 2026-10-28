import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { AccountCard } from "./account-card";
import { TextTemplatesCard } from "./text-templates-card";
import { kstDate } from "@/lib/hospital-link";
import { ClinicScheduleCard } from "./clinic-schedule-card";
import { parseSchedule } from "@/lib/clinic-schedule";
import { effectiveSchedule } from "@/lib/clinic-schedule-store";
import { SETTINGS_TABS, SectionTabs } from "@/components/section-tabs";
import { OtpCard } from "./otp-card";
import { OsaSheetCard } from "./osa-sheet-card";
import { DeptCalendarCard } from "./dept-calendar-card";

// 설정 > 일반 — 오늘의 번호, OSA 시트, 내 외래 스케줄, 문구 템플릿, 계정, 폰 앱. 수술 관련(수술명 표기·수술 캘린더·수술 종류)은 설정 > 수술 탭으로(사용자 2026-10-27)
export default async function SettingsPage() {
  const user = await getCurrentUser();

  // 내 외래 스케줄 + 최근 90일 외래 명단이 있던 요일(참고)
  const [me, recentLists] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { clinicSchedule: true } }),
    prisma.outpatientList.findMany({ where: { createdById: user.id, date: { gte: kstDate(new Date(), -90) } }, select: { date: true, rows: true } }),
  ]);
  const dayCount = new Map<number, number>();
  for (const l of recentLists) if (Array.isArray(l.rows) && l.rows.length) { const wd = new Date(`${l.date}T00:00:00Z`).getUTCDay(); dayCount.set(wd, (dayCount.get(wd) ?? 0) + 1); }
  const historyDays = [...dayCount.entries()].sort((a, b) => a[0] - b[0]).map(([wd, n]) => `${"일월화수목금토"[wd]}(${n})`).join(" ");
  // 다음 외래 계산에 실제로 쓰는 스케줄(손으로 저장한 것, 없으면 예약 명단으로 자동 판단)
  const eff = await effectiveSchedule(user.id);
  const inUse = {
    source: eff.source,
    text: eff.schedule
      .map((s) => `${"일월화수목금토"[s.weekday]} ${s.session === "AM" ? "오전" : "오후"} ${s.everyOtherFrom ? `격주(${s.everyOtherFrom.slice(5).replace("-", "/")} 기준)` : "매주"}`)
      .join(" · "),
  };

  // 비과 일정 구독 주소 — 지금 접속한 주소(운영/미리보기) 기준(수술 탭의 개인 수술 피드와 같은 방식)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const deptFeedUrl = user.deptCalendarToken && host ? `${proto}://${host}/api/dept-calendar/${user.deptCalendarToken}` : null;

  const templates = await prisma.textTemplate.findMany({
    where: { createdById: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, body: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">설정</h1>
        <SectionTabs tabs={SETTINGS_TABS} current="/settings" />
      </div>

      <div className="max-w-lg space-y-8">
      <div id="otp" className="scroll-mt-24">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">오늘의 번호 (진료실 PC 프로그램 연결)</h2>
        <OtpCard userId={user.id} />
      </div>

      <div id="osa" className="scroll-mt-24">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">OSA 시트 연결 (CPAP 처방 등록·결과 메일 확인)</h2>
        <OsaSheetCard connected={!!(await prisma.user.findUnique({ where: { id: user.id }, select: { osaScriptUrl: true } }))?.osaScriptUrl} />
      </div>

      <div id="dept-calendar" className="scroll-mt-24">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">비과 일정 캘린더 구독 (교수님 4분 수술·외래·부재)</h2>
        <DeptCalendarCard feedUrl={deptFeedUrl} />
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">내 외래 스케줄</h2>
        <ClinicScheduleCard schedule={parseSchedule(me?.clinicSchedule)} historyDays={historyDays} inUse={inUse} />
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">문구 템플릿</h2>
        <TextTemplatesCard templates={templates} />
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">계정 보안</h2>
        <p className="mb-3 text-sm text-slate-500">{user.email}</p>
        <AccountCard />
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">폰에 앱으로 설치</h2>
        <div className="space-y-1.5 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-800">아이폰(Safari)</span>: 하단 공유 버튼 → &quot;홈 화면에
            추가&quot;
          </p>
          <p>
            <span className="font-medium text-slate-800">안드로이드(Chrome)</span>: 오른쪽 위 ⋮ 메뉴 →
            &quot;홈 화면에 추가&quot; 또는 &quot;앱 설치&quot;
          </p>
          <p className="text-xs text-slate-400">
            홈 화면 앱은 브라우저와 로그인 정보가 따로라서, 설치 후 처음 한 번 다시 로그인해야 합니다.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
