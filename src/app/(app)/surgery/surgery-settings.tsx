import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { procedureNameFor, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { safeDateStr, seoulTodayAsStoredDate } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { SettingsForm } from "../settings/settings-form";
import { CalendarSubscribeCard } from "../settings/calendar-subscribe-card";
import { SurgeryTypesManager } from "../surgery-types/surgery-types-manager";

// 설정 > 수술 탭 아래 — 수술명 표기, 수술 캘린더 연동, 수술 종류 관리(사용자 2026-10-27 "수술 관련된 건 수술 탭으로 다 이동").
// 예전 설정 > 일반에 있던 것 그대로
export async function SurgerySettings() {
  const user = await getCurrentUser();
  const nameStyle: NameStyle = { sideNotation: user.sideNotation as SideNotation, abbreviateRegions: user.abbreviateRegions };
  // 구독 주소는 지금 접속한 주소(운영/미리보기)를 기준으로 만든다.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const feedUrl = user.calendarToken && host ? `${proto}://${host}/api/calendar/${user.calendarToken}` : null;
  // 한국 시간 기준 오늘 — "완료"로 표시해 둔 계획은 캘린더에 새로 추가할 필요가 없으니 뺀다
  const upcomingPlans = await prisma.opPlan.findMany({
    where: { createdById: user.id, plannedDate: { gte: seoulTodayAsStoredDate() }, status: { not: "DONE" } },
    orderBy: { plannedDate: "asc" },
    include: { surgeryType: { select: { code: true, name: true } } },
  });

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">수술명 표기</h2>
        <p className="mb-3 text-sm text-slate-500">자동 생성되는 수술명의 방향/부위 표기 방식을 정할 수 있습니다.</p>
        <SettingsForm initialSideNotation={user.sideNotation as SideNotation} initialAbbreviate={user.abbreviateRegions} />
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">수술 캘린더 연동</h2>
        <p className="mb-3 text-sm text-slate-500">다가오는 수술을 캘린더에 추가할 수 있습니다. (개인정보 보호를 위해 환자 이름은 표시되지 않습니다)</p>
        <div className="mb-4">
          <CalendarSubscribeCard feedUrl={feedUrl} />
        </div>
        <p className="mb-2 text-xs font-medium text-slate-500">수술별로 하나씩 추가</p>
        {upcomingPlans.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-400">예정된 수술이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {upcomingPlans.map((plan) => {
              const procedureName = procedureNameFor(plan.surgeryType, parseFieldValues(plan.planData), nameStyle);
              return (
                <li key={plan.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
                  <span className="font-medium text-slate-900">{safeDateStr(plan.plannedDate)}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{procedureName}</span>
                  <a href={buildGoogleCalendarUrl({ title: `[수술] ${procedureName}`, date: plan.plannedDate! })} target="_blank" rel="noopener noreferrer" className={`ml-auto ${buttonStyles.smallOutline}`}>
                    Google 캘린더
                  </a>
                  <a href={`/plans/${plan.id}/ics`} className={buttonStyles.smallOutline}>
                    .ics 다운로드
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">수술 종류 관리</h2>
        <p className="mb-3 text-sm text-slate-500">기본 제공되는 ESS/비중격교정술 외에, 다루는 이비인후과 수술을 자유롭게 추가하거나 입력 항목을 확인할 수 있습니다.</p>
        <SurgeryTypesManager />
      </div>
    </div>
  );
}
