import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import {
  buildProcedureName,
  nasalFindingsText,
  type NameStyle,
  type SideNotation,
} from "@/lib/op-note-generator";

export default async function PatientDetailPage({
  params,
}: PageProps<"/patients/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      opPlans: {
        orderBy: { createdAt: "desc" },
        include: { surgeryType: true, opRecord: { select: { id: true } } },
      },
    },
  });

  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{patient.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {patient.chartNo ? `차트번호 ${patient.chartNo} · ` : ""}
            {patient.sex === "M" ? "남" : patient.sex === "F" ? "여" : "성별 미상"}
            {patient.birthDate
              ? ` · ${patient.birthDate.toISOString().slice(0, 10)} 생`
              : ""}
          </p>
          {patient.memo && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {patient.memo}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/patients/${patient.id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            정보 수정
          </Link>
          <Link
            href={`/patients/${patient.id}/plans/new`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            + 수술 계획 작성
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          수술 계획 / 기록지
        </h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">수술 이름</th>
                <th className="px-4 py-2 font-medium">예정일</th>
                <th className="px-4 py-2 font-medium">비강/영상 소견</th>
                <th className="px-4 py-2 font-medium">Op Plan</th>
                <th className="px-4 py-2 font-medium">수술 기록지</th>
              </tr>
            </thead>
            <tbody>
              {patient.opPlans.map((plan) => {
                const code = plan.surgeryType.code;
                const values = parseFieldValues(plan.planData);
                const procedureName = isBuiltInSurgeryCode(code)
                  ? buildProcedureName(code, values, nameStyle)
                  : plan.surgeryType.name;
                const findings = isBuiltInSurgeryCode(code)
                  ? nasalFindingsText(values)
                  : "-";
                return (
                  <tr key={plan.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      <Link href={`/plans/${plan.id}`} className="hover:underline">
                        {procedureName}
                      </Link>
                      {plan.side && (
                        <span className="ml-1 font-normal text-slate-500">({plan.side})</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <Link href={`/plans/${plan.id}`} className="hover:underline">
                        {plan.plannedDate ? plan.plannedDate.toISOString().slice(0, 10) : "입력"}
                      </Link>
                    </td>
                    <td className="max-w-xs px-4 py-2 text-slate-600">
                      <Link href={`/plans/${plan.id}`} className="hover:underline">
                        {findings}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/plans/${plan.id}`} className="text-slate-900 underline">
                        계획 보기
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {plan.opRecord ? (
                        <Link href={`/records/${plan.opRecord.id}`} className="text-slate-900 underline">
                          기록지 보기
                        </Link>
                      ) : (
                        <Link href={`/plans/${plan.id}/record`} className="text-slate-500 underline">
                          기록지 작성
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {patient.opPlans.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    아직 등록된 수술 계획이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
