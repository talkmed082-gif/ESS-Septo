import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { deleteOpPlan, updateOpPlan } from "@/app/actions/op-plans";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { getRecentCombosForSurgeryType } from "@/lib/recent-combos";
import { getPresetsForSurgeryType } from "@/lib/presets";
import { SurgeryPlanner } from "@/components/surgery-planner";
import { buttonStyles } from "@/lib/ui";

export default async function OpPlanPage({
  params,
}: PageProps<"/plans/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;

  const plan = await prisma.opPlan.findUnique({
    where: { id },
    include: { patient: true, surgeryType: true, opRecord: { select: { id: true } } },
  });
  if (!plan) notFound();

  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };
  const fields = parseFieldDefs(plan.surgeryType.fields);
  const values = parseFieldValues(plan.planData);
  const recentCombos = await getRecentCombosForSurgeryType(
    user.id,
    plan.surgeryTypeId,
    plan.surgeryType.code,
    nameStyle,
  );
  const presets = await getPresetsForSurgeryType(user.id, plan.surgeryTypeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {plan.surgeryType.name} 수술 계획
          </h1>
          <Link
            href={`/patients/${plan.patientId}/edit?from=${encodeURIComponent(`/plans/${plan.id}`)}`}
            className={`mt-1 inline-block ${buttonStyles.link}`}
          >
            환자 정보 수정
          </Link>
        </div>
        <div className="flex gap-2">
          <Link href={`/plans/${plan.id}/print`} className={buttonStyles.secondarySmall}>
            인쇄용 보기
          </Link>
          {plan.opRecord ? (
            <Link href={`/records/${plan.opRecord.id}`} className={buttonStyles.accent}>
              기록지 보기
            </Link>
          ) : (
            <Link href={`/plans/${plan.id}/record`} className={buttonStyles.accent}>
              기록지 작성
            </Link>
          )}
          <form action={deleteOpPlan.bind(null, plan.id, plan.patientId)}>
            <button type="submit" className={buttonStyles.danger}>
              계획 삭제
            </button>
          </form>
        </div>
      </div>

      <SurgeryPlanner
        surgeryTypes={[
          {
            id: plan.surgeryTypeId,
            code: plan.surgeryType.code,
            name: plan.surgeryType.name,
            fields,
          },
        ]}
        loggedIn
        nameStyle={nameStyle}
        recentCombosByType={{ [plan.surgeryTypeId]: recentCombos }}
        presetsByType={{ [plan.surgeryTypeId]: presets }}
        fixedPatient={{ id: plan.patient.id, name: plan.patient.name }}
        editPlan={{
          surgeryTypeId: plan.surgeryTypeId,
          // 화면에 더 이상 날짜 입력란이 없으므로, 없던 날짜를 오늘 날짜로
          // 지어내지 않고 있는 그대로("" = 없음)를 넘겨서 수정 시 값이
          // 유지되게 한다.
          plannedDate: safeDateStr(plan.plannedDate) ?? "",
          values,
        }}
        action={updateOpPlan.bind(null, plan.id)}
      />
    </div>
  );
}
