import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildPlanTable, planTableToText, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { PlanTableView } from "@/components/plan-table";
import { PrintButton } from "@/components/print-button";
import { SaveImageButton } from "@/components/save-image-button";
import { CopyButton } from "@/components/copy-button";
import { AppNavBar } from "@/components/app-nav-bar";
import { safeDateStr } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";

export default async function OpPlanPrintPage({
  params,
}: PageProps<"/plans/[id]/print">) {
  const user = await getCurrentUser();
  const { id } = await params;

  const plan = await prisma.opPlan.findFirst({
    where: { id, createdById: user.id },
    include: { patient: true, surgeryType: true },
  });
  if (!plan) notFound();

  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };
  const values = parseFieldValues(plan.planData);
  const table = isBuiltInSurgeryCode(plan.surgeryType.code)
    ? buildPlanTable(plan.surgeryType.code, values, nameStyle)
    : null;

  return (
    <div>
      <AppNavBar />
      <div className="mx-auto w-full max-w-2xl bg-white px-3 pt-4 pb-3 text-slate-900 sm:px-8 sm:pt-6 sm:pb-8 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href={`/plans/${plan.id}`} className={buttonStyles.link}>
            ← 계획으로 돌아가기
          </Link>
          <div className="flex flex-wrap gap-2">
            {table && <CopyButton text={planTableToText(table)} label="내용 복사" className={buttonStyles.secondary} />}
            <SaveImageButton
              targetId="op-plan-print-content"
              fileName={`${plan.patient.name}_수술계획표.jpg`}
              shareTitle={`${plan.patient.name} 수술계획표`}
            />
            <PrintButton />
          </div>
        </div>

        <div id="op-plan-print-content" className="bg-white p-3 sm:p-0">
          <h1 className="mb-1 text-center text-lg font-bold sm:text-2xl">수 술 계 획 표</h1>
          <p className="mb-6 text-center text-sm text-slate-500 sm:text-base">
            ({plan.surgeryType.name})
          </p>

          <div className="mb-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm sm:text-lg">
              <tbody>
                <tr>
                  <th className="w-24 border border-slate-400 bg-slate-50 px-2 py-2 text-left font-medium sm:w-32 sm:px-3 sm:py-2.5">
                    환자명
                  </th>
                  <td className="border border-slate-400 px-2 py-2 font-semibold sm:px-3 sm:py-2.5">
                    {plan.patient.name}
                  </td>
                </tr>
                <tr>
                  <th className="border border-slate-400 bg-slate-50 px-2 py-2 text-left font-medium sm:px-3 sm:py-2.5">
                    수술일
                  </th>
                  <td className="border border-slate-400 px-2 py-2 sm:px-3 sm:py-2.5">
                    {safeDateStr(plan.plannedDate) ?? "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {table ? (
            <PlanTableView table={table} />
          ) : (
            <p className="whitespace-pre-wrap text-sm sm:text-lg">{plan.planNote}</p>
          )}

          {plan.planNote && table && (
            <div className="mt-4 rounded-md border border-slate-300 p-3 text-sm whitespace-pre-wrap sm:text-base">
              <span className="font-semibold">메모: </span>
              {plan.planNote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
