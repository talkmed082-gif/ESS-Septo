import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildPlanTable, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { PlanTableView } from "@/components/plan-table";
import { buttonStyles } from "@/lib/ui";

export default async function PatientDetailPage({
  params,
}: PageProps<"/patients/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      opPlans: {
        orderBy: { createdAt: "desc" },
        include: {
          surgeryType: true,
          opRecord: {
            select: { id: true, procedureName: true, findings: true, procedureDetail: true },
          },
        },
      },
    },
  });

  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{patient.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {patient.chartNo ? `차트번호 ${patient.chartNo} · ` : ""}
            {patient.sex === "M" ? "남" : patient.sex === "F" ? "여" : "성별 미상"}
            {patient.age != null ? ` · 만 ${patient.age}세` : ""}
          </p>
          {patient.memo && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {patient.memo}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/patients/${patient.id}/edit?from=${encodeURIComponent(`/patients/${patient.id}`)}`}
            className={buttonStyles.secondarySmall}
          >
            정보 수정
          </Link>
          <Link href={`/patients/${patient.id}/plans/new`} className={buttonStyles.primarySmall}>
            + 수술 계획 작성
          </Link>
        </div>
      </div>

      {patient.opPlans.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          아직 등록된 수술 계획이 없습니다.
        </div>
      )}

      {patient.opPlans.map((plan) => {
        const code = plan.surgeryType.code;
        const values = parseFieldValues(plan.planData);
        const table = isBuiltInSurgeryCode(code) ? buildPlanTable(code, values, nameStyle) : null;

        return (
          <div key={plan.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="text-sm text-slate-500">
                예정일: <span className="font-medium text-slate-900">{safeDateStr(plan.plannedDate) ?? "미정"}</span>
              </div>
              <div className="flex gap-2">
                <Link href={`/plans/${plan.id}`} className={buttonStyles.smallOutline}>
                  계획 수정
                </Link>
                {plan.opRecord ? (
                  <Link href={`/records/${plan.opRecord.id}/edit`} className={buttonStyles.smallOutline}>
                    기록지 수정
                  </Link>
                ) : (
                  <Link href={`/plans/${plan.id}/record`} className={buttonStyles.smallOutlineAccent}>
                    기록지 작성
                  </Link>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Op Plan</h2>
              {table ? (
                <PlanTableView table={table} />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-slate-600">
                  {plan.planNote || "-"}
                </p>
              )}
            </div>

            {plan.opRecord && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-700">수술기록지</h2>
                <p className="mb-2 text-base font-bold text-slate-900">
                  {plan.opRecord.procedureName || "-"}
                </p>
                <div className="rounded-md border border-slate-200 p-3 text-sm whitespace-pre-wrap text-slate-700">
                  {[plan.opRecord.findings, plan.opRecord.procedureDetail].filter(Boolean).join("\n\n") || "-"}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
