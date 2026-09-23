import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";
import { PrintButton } from "@/components/print-button";
import { SaveImageButton } from "@/components/save-image-button";
import { CopyButton } from "@/components/copy-button";
import { AppNavBar } from "@/components/app-nav-bar";
import { safeDateStr } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";

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
  const session = await verifySession();
  const { id } = await params;

  const record = await prisma.opRecord.findFirst({
    where: { id, createdById: session.userId },
    include: {
      opPlan: { include: { patient: true, surgeryType: true } },
    },
  });
  if (!record) notFound();

  const patient = record.opPlan.patient;
  const fields = resolveSurgeryTypeFields(record.opPlan.surgeryType);
  const values = parseFieldValues(record.recordData);

  const checkedFields = fields.filter((f) => f.type === "checkbox" && values[f.key]);
  const otherFields = fields.filter(
    (f) => f.type !== "checkbox" && values[f.key],
  );

  // 병원 EMR 등 다른 곳에 옮겨 적을 수 있게, 수술명 + 소견/과정을 통째로
  // 복사할 수 있는 텍스트를 만든다.
  const copyText = [
    record.procedureName,
    [record.findings, record.procedureDetail].filter(Boolean).join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div>
      <AppNavBar />
      <div className="mx-auto w-full max-w-3xl bg-white px-3 pt-4 pb-3 text-slate-900 sm:px-8 sm:pt-6 sm:pb-8 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href={`/records/${record.id}`} className={buttonStyles.link}>
            ← 기록지로 돌아가기
          </Link>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={copyText} label="내용 복사" className={buttonStyles.secondary} />
            <SaveImageButton
              targetId="op-record-print-content"
              fileName={`${patient.name}_수술기록지.jpg`}
              shareTitle={`${patient.name} 수술기록지`}
            />
            <PrintButton />
          </div>
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
                <Row
                  label="수술 소견 및 과정"
                  value={[record.findings, record.procedureDetail].filter(Boolean).join("\n\n")}
                />
              </tbody>
            </table>
          </div>

          <div className="mt-12 flex justify-end text-sm">
            <p>집도의: {record.surgeonName} (인)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
