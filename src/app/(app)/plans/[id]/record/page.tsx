import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { createOpRecord } from "@/app/actions/op-records";
import { buildProcedureName, generateOpNote, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { isBuiltInSurgeryCode, resolveSurgeryTypeFields } from "@/lib/op-note-defs";
import { safeDateStr } from "@/lib/date-format";
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
  const planValues = parseFieldValues(plan.planData);
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
          operationDate: safeDateStr(plan.plannedDate) ?? new Date().toISOString().slice(0, 10),
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
