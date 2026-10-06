import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { createOpRecord } from "@/app/actions/op-records";
import { buildProcedureName, generateOpNote, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { isBuiltInSurgeryCode, resolveSurgeryTypeFields } from "@/lib/op-note-defs";
import { safeDateStr, seoulNow } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { RecordForm } from "../../../records/record-form";

export default async function NewOpRecordPage({
  params,
}: PageProps<"/plans/[id]/record">) {
  const currentUser = await getCurrentUser();
  const { id: planId } = await params;

  const plan = await prisma.opPlan.findFirst({
    where: { id: planId, createdById: currentUser.id },
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
  const fields = resolveSurgeryTypeFields(plan.surgeryType);
  // 완료된 계획은 "수술 후" 화면에서 고친 실제 시행 내역(actualData)이 따로 있어서,
  // 기록지 초안도 그 값을 우선해야 한다 — 예전엔 원래 계획(planData)만 읽어서 수술
  // 후에 고친 내용이 정식 기록지에서 빠졌다. 계획 화면의 초안과 같은 기준이다.
  const planValues =
    plan.status === "DONE"
      ? { ...parseFieldValues(plan.planData), ...parseFieldValues(plan.actualData) }
      : parseFieldValues(plan.planData);
  const action = createOpRecord.bind(null, planId);

  const code = plan.surgeryType.code;
  const auto = isBuiltInSurgeryCode(code)
    ? { procedureName: buildProcedureName(code, planValues, nameStyle), ...generateOpNote(code, planValues, "record") }
    : { procedureName: "", findings: "", procedureDetail: "" };

  return (
    <div className="max-w-3xl">
      <Link href={`/plans/${plan.id}`} className={buttonStyles.link}>
        ← 수술 계획으로 돌아가기
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold">수술기록지 작성</h1>
      <p className="mb-6 text-sm text-slate-500">
        환자: {plan.patient.name} · {plan.surgeryType.name}
      </p>

      <RecordForm
        action={action}
        surgeryTypeCode={plan.surgeryType.code}
        fields={fields}
        fieldValues={planValues}
        defaultValues={{
          operationDate: safeDateStr(plan.plannedDate) ?? seoulNow().date,
          surgeonName: currentUser.name,
          anesthesiaType: "General",
          procedureName: auto.procedureName,
          findings: auto.findings,
          procedureDetail: auto.procedureDetail,
        }}
        nameStyle={nameStyle}
      />
    </div>
  );
}
