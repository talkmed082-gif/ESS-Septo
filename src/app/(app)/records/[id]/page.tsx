import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { isUnusedSideField, resolveSurgeryTypeFields } from "@/lib/op-note-defs";
import { safeDateStr } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { buildRemarkText } from "@/lib/remark";
import { CopyButton } from "@/components/copy-button";

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
  const session = await verifySession();
  const { id } = await params;

  const record = await prisma.opRecord.findFirst({
    where: { id, createdById: session.userId },
    include: {
      opPlan: { include: { patient: true, surgeryType: true } },
    },
  });
  if (!record) notFound();

  const fields = resolveSurgeryTypeFields(record.opPlan.surgeryType);
  const values = parseFieldValues(record.recordData);
  // 기록지를 다 쓴 뒤에도 여기서 바로 차트 remark를 복사할 수 있게 한다 —
  // 수술명·날짜는 기록지에 최종으로 적은 값을 쓴다.
  const remarkText = buildRemarkText({
    chiefComplaint: record.opPlan.chiefComplaint ?? "",
    surgeryDate: safeDateStr(record.operationDate) ?? "",
    procedureName: record.procedureName ?? "",
    postOpRemark: record.opPlan.postOpRemark ?? "",
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/patients/${record.opPlan.patientId}`} className={buttonStyles.link}>
            ← {record.opPlan.patient.name} 환자로 돌아가기
          </Link>
          <h1 className="mt-2 text-xl font-semibold">
            {record.opPlan.surgeryType.name} 수술기록지
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/records/${record.id}/print`} className={buttonStyles.secondarySmall}>
            인쇄용 보기
          </Link>
          <Link href={`/records/${record.id}/edit`} className={buttonStyles.primarySmall}>
            수정
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl>
          <Row label="환자" value={record.opPlan.patient.name} />
          <Row label="CC" value={record.opPlan.chiefComplaint} />
          <Row
            label="수술일"
            value={safeDateStr(record.operationDate)}
          />
          <Row label="집도의" value={record.surgeonName} />
          <Row label="마취" value={record.anesthesiaType} />
          <Row label="시행 수술명" value={record.procedureName} />
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">차트 Remark</h2>
          <div className="flex gap-2">
            <Link href={`/plans/${record.opPlan.id}?view=post`} className={buttonStyles.smallOutline}>
              CC·특이사항 수정
            </Link>
            <CopyButton text={remarkText} disabled={!remarkText} />
          </div>
        </div>
        {remarkText ? (
          <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-sans text-sm text-slate-800">
            {remarkText}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">수술 계획 화면에서 CC와 수술 후 특이사항을 적으면 여기에 표시됩니다.</p>
        )}
      </div>

      {fields.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            수술 소견 / 시행 항목
          </h2>
          <ul className="space-y-1 text-sm">
            {fields.map((f) => {
              const v = values[f.key];
              if (isUnusedSideField(f.key, values)) return null;
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
          <Row
            label="수술 소견 및 과정"
            value={[record.findings, record.procedureDetail].filter(Boolean).join("\n\n")}
          />
        </dl>
      </div>
    </div>
  );
}
