import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildPlanTable, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { PlanTableView } from "@/components/plan-table";
import { PrintButton } from "@/components/print-button";
import { safeDateStr } from "@/lib/date-format";

export default async function OpPlanPrintPage({
  params,
}: PageProps<"/plans/[id]/print">) {
  const user = await getCurrentUser();
  const { id } = await params;

  const plan = await prisma.opPlan.findUnique({
    where: { id },
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
    <div className="mx-auto max-w-2xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <h1 className="mb-1 text-center text-2xl font-bold">수 술 계 획 표</h1>
      <p className="mb-6 text-center text-base text-slate-500">
        ({plan.surgeryType.name})
      </p>

      <table className="mb-6 w-full border-collapse text-lg">
        <tbody>
          <tr>
            <th className="w-32 border border-slate-400 bg-slate-50 px-3 py-2.5 text-left font-medium">
              환자명
            </th>
            <td className="border border-slate-400 px-3 py-2.5 font-semibold">
              {plan.patient.name}
            </td>
          </tr>
          <tr>
            <th className="border border-slate-400 bg-slate-50 px-3 py-2.5 text-left font-medium">
              수술일 / 수술측
            </th>
            <td className="border border-slate-400 px-3 py-2.5">
              {safeDateStr(plan.plannedDate) ?? "-"} /{" "}
              <span className="font-semibold">{plan.side ?? "-"}</span>
            </td>
          </tr>
          <tr>
            <th className="border border-slate-400 bg-slate-50 px-3 py-2.5 text-left font-medium">
              진단명
            </th>
            <td className="border border-slate-400 px-3 py-2.5">{plan.diagnosis ?? "-"}</td>
          </tr>
        </tbody>
      </table>

      {table ? (
        <PlanTableView table={table} size="large" />
      ) : (
        <p className="whitespace-pre-wrap text-lg">{plan.planNote}</p>
      )}

      {plan.planNote && table && (
        <div className="mt-4 rounded-md border border-slate-300 p-3 text-base whitespace-pre-wrap">
          <span className="font-semibold">메모: </span>
          {plan.planNote}
        </div>
      )}
    </div>
  );
}
