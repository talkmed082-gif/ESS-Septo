import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { updateOpRecord } from "@/app/actions/op-records";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { RecordForm } from "../../record-form";

export default async function EditOpRecordPage({
  params,
}: PageProps<"/records/[id]/edit">) {
  const user = await getCurrentUser();
  const { id } = await params;

  const record = await prisma.opRecord.findUnique({
    where: { id },
    include: { opPlan: { include: { patient: true, surgeryType: true } } },
  });
  if (!record) notFound();

  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };
  const fields = parseFieldDefs(record.opPlan.surgeryType.fields);
  const values = parseFieldValues(record.recordData);
  const action = updateOpRecord.bind(null, record.id);

  return (
    <div className="max-w-3xl">
      <Link href={`/records/${record.id}`} className="text-sm text-slate-500 hover:underline">
        ← 기록지로 돌아가기
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold">수술기록지 수정</h1>
      <p className="mb-6 text-sm text-slate-500">
        환자: {record.opPlan.patient.name} · {record.opPlan.surgeryType.name}
      </p>

      <RecordForm
        action={action}
        surgeryTypeCode={record.opPlan.surgeryType.code}
        fields={fields}
        fieldValues={values}
        submitLabel="저장"
        defaultValues={{
          operationDate: safeDateStr(record.operationDate) ?? new Date().toISOString().slice(0, 10),
          surgeonName: record.surgeonName,
          anesthesiaType: record.anesthesiaType ?? "",
          procedureName: record.procedureName ?? "",
          findings: record.findings ?? "",
          procedureDetail: record.procedureDetail ?? "",
        }}
        nameStyle={nameStyle}
      />
    </div>
  );
}
