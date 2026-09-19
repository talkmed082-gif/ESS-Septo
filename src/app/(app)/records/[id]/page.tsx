import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { safeDateStr } from "@/lib/date-format";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-4 border-t border-slate-100 py-2 text-sm first:border-t-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 whitespace-pre-wrap text-slate-900">{value}</dd>
    </div>
  );
}

export default async function OpRecordPage({
  params,
}: PageProps<"/records/[id]">) {
  await verifySession();
  const { id } = await params;

  const record = await prisma.opRecord.findUnique({
    where: { id },
    include: {
      opPlan: { include: { patient: true, surgeryType: true } },
    },
  });
  if (!record) notFound();

  const fields = parseFieldDefs(record.opPlan.surgeryType.fields);
  const values = parseFieldValues(record.recordData);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/patients/${record.opPlan.patientId}`}
            className="text-sm text-slate-500 hover:underline"
          >
            ← {record.opPlan.patient.name} 환자로 돌아가기
          </Link>
          <h1 className="mt-2 text-xl font-semibold">
            {record.opPlan.surgeryType.name} 수술기록지
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/records/${record.id}/print`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            인쇄용 보기
          </Link>
          <Link
            href={`/records/${record.id}/edit`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            수정
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl>
          <Row label="환자" value={record.opPlan.patient.name} />
          <Row
            label="수술일"
            value={safeDateStr(record.operationDate)}
          />
          <Row label="수술측" value={record.opPlan.side} />
          <Row label="집도의" value={record.surgeonName} />
          <Row label="보조의" value={record.assistantName} />
          <Row label="마취" value={record.anesthesiaType} />
          <Row label="술전 진단명" value={record.preOpDiagnosis} />
          <Row label="술후 진단명" value={record.postOpDiagnosis} />
          <Row label="시행 수술명" value={record.procedureName} />
        </dl>
      </div>

      {fields.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            수술 소견 / 시행 항목
          </h2>
          <ul className="space-y-1 text-sm">
            {fields.map((f) => {
              const v = values[f.key];
              if (f.type === "checkbox") {
                if (!v) return null;
                return <li key={f.key}>✓ {f.label}</li>;
              }
              if (!v) return null;
              return (
                <li key={f.key}>
                  <span className="text-slate-500">{f.label}:</span> {String(v)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl>
          <Row label="수술 소견" value={record.findings} />
          <Row label="수술 과정" value={record.procedureDetail} />
          <Row label="합병증" value={record.complication} />
          <Row label="추정 출혈량" value={record.estimatedBloodLoss} />
          <Row label="검체" value={record.specimen} />
          <Row label="술후 계획" value={record.postOpPlan} />
        </dl>
      </div>
    </div>
  );
}
