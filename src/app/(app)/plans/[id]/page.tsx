import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { deleteOpPlan } from "@/app/actions/op-plans";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import {
  buildPlanTable,
  buildProcedureName,
  nasalFindingsText,
  type NameStyle,
  type SideNotation,
} from "@/lib/op-note-generator";
import { buildGoogleCalendarUrl } from "@/lib/calendar";
import { safeDateStr } from "@/lib/date-format";
import { getRecentCombosForSurgeryType } from "@/lib/recent-combos";
import { getPresetsForSurgeryType } from "@/lib/presets";
import { PlanTableView } from "@/components/plan-table";
import { PlanEditForm } from "./plan-edit-form";

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
  const table = isBuiltInSurgeryCode(plan.surgeryType.code)
    ? buildPlanTable(plan.surgeryType.code, values, nameStyle)
    : null;
  const recentCombos = await getRecentCombosForSurgeryType(
    user.id,
    plan.surgeryTypeId,
    plan.surgeryType.code,
    nameStyle,
  );
  const presets = await getPresetsForSurgeryType(user.id, plan.surgeryTypeId);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href={`/patients/${plan.patientId}`} className="text-sm text-slate-500 hover:underline">
          ← {plan.patient.name} 환자로 돌아가기
        </Link>
        <h1 className="mt-2 text-xl font-semibold">
          {plan.surgeryType.name} 수술 계획
        </h1>
      </div>

      {plan.plannedDate && safeDateStr(plan.plannedDate) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <span className="text-slate-500">
            수술 예정일: <span className="font-medium text-slate-900">{safeDateStr(plan.plannedDate)}</span>
          </span>
          <a
            href={buildGoogleCalendarUrl({
              title: `[수술] ${plan.patient.name} - ${
                isBuiltInSurgeryCode(plan.surgeryType.code)
                  ? buildProcedureName(plan.surgeryType.code, values, nameStyle)
                  : plan.surgeryType.name
              }`,
              date: plan.plannedDate,
              details: [plan.diagnosis, plan.side].filter(Boolean).join(" / "),
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            Google 캘린더에 추가
          </a>
          <a
            href={`/plans/${plan.id}/ics`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            캘린더 파일(.ics) 다운로드
          </a>
        </div>
      )}

      {isBuiltInSurgeryCode(plan.surgeryType.code) && nasalFindingsText(values) && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">비강/영상 소견</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {nasalFindingsText(values)}
          </p>
        </div>
      )}

      {table && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">예정 술식 표</h2>
            <Link
              href={`/plans/${plan.id}/print`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              인쇄용 보기
            </Link>
          </div>
          <PlanTableView table={table} />
        </div>
      )}

      <div className="flex gap-2">
        {plan.opRecord ? (
          <Link
            href={`/records/${plan.opRecord.id}`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            기록지 보기
          </Link>
        ) : (
          <Link
            href={`/plans/${plan.id}/record`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            기록지 작성
          </Link>
        )}
        <form action={deleteOpPlan.bind(null, plan.id, plan.patientId)}>
          <button
            type="submit"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            계획 삭제
          </button>
        </form>
      </div>

      <PlanEditForm
        planId={plan.id}
        surgeryTypeId={plan.surgeryTypeId}
        surgeryTypeCode={plan.surgeryType.code}
        fields={fields}
        values={values}
        defaultValues={{
          plannedDate: safeDateStr(plan.plannedDate) ?? "",
          side: plan.side ?? "",
          diagnosis: plan.diagnosis ?? "",
          planNote: plan.planNote ?? "",
        }}
        nameStyle={nameStyle}
        recentCombos={recentCombos}
        presets={presets}
      />
    </div>
  );
}
