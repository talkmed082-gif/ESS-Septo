import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { PrintButton } from "@/components/print-button";
import { SaveImageButton } from "@/components/save-image-button";
import { safeDateStr } from "@/lib/date-format";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr>
      <th className="w-24 border border-slate-400 bg-slate-50 px-2 py-1.5 text-left align-top text-xs font-medium sm:w-40 sm:text-sm">
        {label}
      </th>
      <td className="border border-slate-400 px-2 py-1.5 align-top text-xs whitespace-pre-wrap sm:text-sm">
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
    <div className="mx-auto w-full max-w-3xl bg-white p-3 text-slate-900 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap justify-end gap-2 print:hidden">
        <SaveImageButton targetId="op-record-print-content" fileName={`${patient.name}_수술기록지.jpg`} />
        <PrintButton />
      </div>

      <div id="op-record-print-content" className="bg-white p-3 sm:p-0">
        <h1 className="mb-6 text-center text-lg font-bold sm:text-2xl">수 술 기 록 지</h1>
        <p className="mb-4 text-center text-xs text-slate-500 sm:text-sm">
          (Operative Record — {record.opPlan.surgeryType.name})
        </p>

        <div className="overflow-x-auto">
          <table className="mb-6 w-full border-collapse">
            <tbody>
              <Row label="환자명" value={patient.name} />
              <Row label="차트번호" value={patient.chartNo} />
              <Row
                label="성별 / 나이"
                value={`${patient.sex === "M" ? "남" : patient.sex === "F" ? "여" : "-"} / ${
                  patient.age != null ? `만 ${patient.age}세` : "-"
                }`}
              />
              <Row label="수술일" value={safeDateStr(record.operationDate) ?? "-"} />
              <Row label="마취 종류" value={record.anesthesiaType} />
              <Row label="집도의" value={record.surgeonName} />
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
            </tbody>
          </table>
        </div>

        <div className="mt-12 flex justify-end text-sm">
          <p>집도의: {record.surgeonName} (인)</p>
        </div>
      </div>
    </div>
  );
}
