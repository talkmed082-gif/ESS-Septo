import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { updateOpPlanStatus, deleteOpPlan } from "@/app/actions/op-plans";
import { PlanEditForm } from "./plan-edit-form";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "PLANNED", label: "계획됨" },
  { value: "DONE", label: "완료" },
  { value: "CANCELLED", label: "취소됨" },
];

export default async function OpPlanPage({
  params,
}: PageProps<"/plans/[id]">) {
  await verifySession();
  const { id } = await params;

  const plan = await prisma.opPlan.findUnique({
    where: { id },
    include: { patient: true, surgeryType: true, opRecord: { select: { id: true } } },
  });
  if (!plan) notFound();

  const fields = parseFieldDefs(plan.surgeryType.fields);
  const values = parseFieldValues(plan.planData);

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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">상태:</span>
        {STATUS_OPTIONS.map((opt) => (
          <form key={opt.value} action={updateOpPlanStatus.bind(null, plan.id, opt.value)}>
            <button
              type="submit"
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                plan.status === opt.value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          </form>
        ))}
      </div>

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
        surgeryTypeCode={plan.surgeryType.code}
        fields={fields}
        values={values}
        defaultValues={{
          plannedDate: plan.plannedDate
            ? plan.plannedDate.toISOString().slice(0, 10)
            : "",
          side: plan.side ?? "",
          diagnosis: plan.diagnosis ?? "",
          planNote: plan.planNote ?? "",
        }}
      />
    </div>
  );
}
