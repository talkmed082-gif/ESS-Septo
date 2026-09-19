import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { PrintButton } from "@/components/print-button";
import { safeDateStr } from "@/lib/date-format";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr>
      <th className="w-40 border border-slate-400 bg-slate-50 px-2 py-1.5 text-left align-top text-sm font-medium">
        {label}
      </th>
      <td className="border border-slate-400 px-2 py-1.5 align-top text-sm whitespace-pre-wrap">
        {value || "-"}
      </td>
    </tr>
  );
}

export default async function OpRecordPrintPage({
  params,
}: PageProps<"/records/[id]/print">) {
  await verifySession();
  const { id } = await params;

  const record = await prisma.opRecord.findUnique({
    where: { id },
    include: {
      opPlan: { include: { patient: true, surgeryType: true } },
    },
  });
  if (!record) notFound();

  const patient = record.opPlan.patient;
  const fields = parseFieldDefs(record.opPlan.surgeryType.fields);
  const values = parseFieldValues(record.recordData);

  const checkedFields = fields.filter((f) => f.type === "checkbox" && values[f.key]);
  const otherFields = fields.filter(
    (f) => f.type !== "checkbox" && values[f.key],
  );

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <h1 className="mb-6 text-center text-2xl font-bold">수 술 기 록 지</h1>
      <p className="mb-4 text-center text-sm text-slate-500">
        (Operative Record — {record.opPlan.surgeryType.name})
      </p>

      <table className="mb-6 w-full border-collapse">
        <tbody>
          <Row label="환자명" value={patient.name} />
          <Row label="차트번호" value={patient.chartNo} />
          <Row
            label="성별 / 생년월일"
            value={`${patient.sex === "M" ? "남" : patient.sex === "F" ? "여" : "-"} / ${
              safeDateStr(patient.birthDate) ?? "-"
            }`}
          />
          <Row label="수술일" value={safeDateStr(record.operationDate) ?? "-"} />
          <Row label="수술측" value={record.opPlan.side} />
          <Row label="마취 종류" value={record.anesthesiaType} />
          <Row label="집도의" value={record.surgeonName} />
          <Row label="보조의" value={record.assistantName} />
          <Row label="술전 진단명" value={record.preOpDiagnosis} />
          <Row label="술후 진단명" value={record.postOpDiagnosis} />
          <Row label="시행 수술명" value={record.procedureName} />
          <Row
            label="시행 항목"
            value={checkedFields.map((f) => f.label).join(", ")}
          />
          {otherFields.map((f) => (
            <Row key={f.key} label={f.label} value={String(values[f.key])} />
          ))}
          <Row label="수술 소견" value={record.findings} />
          <Row label="수술 과정" value={record.procedureDetail} />
          <Row label="합병증" value={record.complication} />
          <Row label="추정 출혈량" value={record.estimatedBloodLoss} />
          <Row label="검체" value={record.specimen} />
          <Row label="술후 계획" value={record.postOpPlan} />
        </tbody>
      </table>

      <div className="mt-12 flex justify-end text-sm">
        <p>집도의: {record.surgeonName} (인)</p>
      </div>
    </div>
  );
}
