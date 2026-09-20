import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildProcedureName, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { safeDateStr } from "@/lib/date-format";
import Link from "next/link";
import { buttonStyles } from "@/lib/ui";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  const todayUtc = new Date(new Date().toISOString().slice(0, 10));
  const upcomingPlans = await prisma.opPlan.findMany({
    // "완료"로 표시해둔 계획은 더 이상 캘린더에 새로 추가할 필요가 없으니 제외한다.
    where: { plannedDate: { gte: todayUtc }, status: { not: "DONE" } },
    orderBy: { plannedDate: "asc" },
    include: { surgeryType: true },
  });

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold">설정</h1>
        <p className="mb-6 text-sm text-slate-500">
          자동 생성되는 수술명의 방향/부위 표기 방식을 정할 수 있습니다.
        </p>
        <SettingsForm
          initialSideNotation={user.sideNotation as SideNotation}
          initialAbbreviate={user.abbreviateRegions}
        />
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">수술 종류 관리</h2>
        <p className="mb-3 text-sm text-slate-500">
          기본 제공되는 ESS/비중격교정술 외에, 다루는 이비인후과 수술을 자유롭게 추가하거나 입력 항목을
          확인할 수 있습니다.
        </p>
        <Link href="/surgery-types" className={buttonStyles.secondarySmall}>
          수술 종류 관리 화면으로 이동
        </Link>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">캘린더 연동</h2>
        <p className="mb-3 text-sm text-slate-500">
          다가오는 수술을 캘린더에 추가할 수 있습니다. (개인정보 보호를 위해 환자 이름은 표시되지 않습니다)
        </p>
        {upcomingPlans.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-400">
            예정된 수술이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcomingPlans.map((plan) => {
              const values = parseFieldValues(plan.planData);
              const procedureName = isBuiltInSurgeryCode(plan.surgeryType.code)
                ? buildProcedureName(plan.surgeryType.code, values, nameStyle)
                : plan.surgeryType.name;
              return (
                <li
                  key={plan.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm"
                >
                  <span className="font-medium text-slate-900">{safeDateStr(plan.plannedDate)}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{procedureName}</span>
                  <a
                    href={buildGoogleCalendarUrl({
                      title: `[수술] ${procedureName}`,
                      date: plan.plannedDate!,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`ml-auto ${buttonStyles.smallOutline}`}
                  >
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
    </div>
  );
}
