import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { createOpRecord } from "@/app/actions/op-records";
import { buildProcedureName, generateOpNote, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { RecordForm } from "../../../records/record-form";

export default async function NewOpRecordPage({
  params,
}: PageProps<"/plans/[id]/record">) {
  const currentUser = await getCurrentUser();
  const { id: planId } = await params;

  const plan = await prisma.opPlan.findUnique({
    where: { id: planId },
    include: { patient: true, surgeryType: true, opRecord: { select: { id: true } } },
  });
  if (!plan) notFound();
  if (plan.opRecord) {
    redirect(`/records/${plan.opRecord.id}`);
  }

  const nameStyle: NameStyle = {
    sideNotation: currentUser.sideNotation as SideNotation,
    abbreviateRegions: currentUser.abbreviateRegions,
  };
  const fields = parseFieldDefs(plan.surgeryType.fields);
  const planValues = parseFieldValues(plan.planData);
  const action = createOpRecord.bind(null, planId);

  const code = plan.surgeryType.code;
  const auto = isBuiltInSurgeryCode(code)
    ? { procedureName: buildProcedureName(code, planValues, nameStyle), ...generateOpNote(code, planValues, "record") }
    : { procedureName: "", findings: "", procedureDetail: "" };

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
            : new Date().toISOString().slice(0, 10),
          surgeonName: currentUser.name,
          assistantName: currentUser.defaultAssistantName ?? "",
          anesthesiaType: "General",
          preOpDiagnosis: plan.diagnosis ?? "",
          postOpDiagnosis: plan.diagnosis ?? "",
          procedureName: auto.procedureName,
          findings: auto.findings,
          procedureDetail: auto.procedureDetail,
          complication: "없음",
          estimatedBloodLoss: "Minimal",
          specimen: "없음",
          postOpPlan: "특이 출혈 소견 없음 확인 후 종료. 익일 외래 재방문 예정.",
        }}
        nameStyle={nameStyle}
      />
    </div>
  );
}
