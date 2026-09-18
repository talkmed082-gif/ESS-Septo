import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { createOpRecord } from "@/app/actions/op-records";
import { RecordForm } from "../../../records/record-form";

export default async function NewOpRecordPage({
  params,
}: PageProps<"/plans/[id]/record">) {
  await verifySession();
  const { id: planId } = await params;

  const plan = await prisma.opPlan.findUnique({
    where: { id: planId },
    include: { patient: true, surgeryType: true, opRecord: { select: { id: true } } },
  });
  if (!plan) notFound();
  if (plan.opRecord) {
    redirect(`/records/${plan.opRecord.id}`);
  }

  const currentUser = await getCurrentUser();
  const fields = parseFieldDefs(plan.surgeryType.fields);
  const planValues = parseFieldValues(plan.planData);
  const action = createOpRecord.bind(null, planId);

  return (
    <div className="max-w-lg">
      <Link href={`/plans/${plan.id}`} className="text-sm text-slate-500 hover:underline">
        ← 수술 계획으로 돌아가기
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold">수술기록지 작성</h1>
      <p className="mb-6 text-sm text-slate-500">
        환자: {plan.patient.name} · {plan.surgeryType.name}
        {plan.side ? ` (${plan.side})` : ""}
      </p>

      <RecordForm
        action={action}
        surgeryTypeCode={plan.surgeryType.code}
        fields={fields}
        fieldValues={planValues}
        submitLabel="기록지 저장"
        defaultValues={{
          operationDate: plan.plannedDate
            ? plan.plannedDate.toISOString().slice(0, 10)
            : "",
          surgeonName: currentUser.name,
          assistantName: "",
          anesthesiaType: "",
          preOpDiagnosis: plan.diagnosis ?? "",
          postOpDiagnosis: "",
          procedureName: "",
          findings: "",
          procedureDetail: "",
          complication: "",
          estimatedBloodLoss: "",
          specimen: "",
          postOpPlan: "",
        }}
      />
    </div>
  );
}
