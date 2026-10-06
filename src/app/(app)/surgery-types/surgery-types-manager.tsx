import { prisma } from "@/lib/prisma";
import { deleteSurgeryType } from "@/app/actions/surgery-types";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";
import { SurgeryTypeFieldBuilder } from "./field-builder";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export async function SurgeryTypesManager() {
  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { opPlans: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">코드</th>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">입력 항목 수</th>
              <th className="px-4 py-2 font-medium">구분</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {surgeryTypes.map((st) => (
              <tr key={st.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs text-slate-600">
                  {st.code}
                </td>
                <td className="px-4 py-2">{st.name}</td>
                <td className="px-4 py-2 text-slate-600">
                  {resolveSurgeryTypeFields(st).length}개
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {st.isBuiltIn ? "기본" : "사용자 추가"}
                </td>
                <td className="px-4 py-2 text-right">
                  {/* 수술 종류는 모든 계정이 같이 쓰고, 계획에서 쓰는 중이면 지울 수 없다 —
                      예전엔 확인 없이 지워지거나, 쓰는 중이면 아무 안내 없이 실패했다. */}
                  {!st.isBuiltIn &&
                    (st._count.opPlans > 0 ? (
                      <span className="text-xs text-slate-400">계획 {st._count.opPlans}건에서 사용 중</span>
                    ) : (
                      <form action={deleteSurgeryType.bind(null, st.id)}>
                        <ConfirmSubmitButton
                          message={`수술 종류 "${st.name}"을(를) 삭제할까요? 다른 계정에서도 함께 사라집니다.`}
                          className="text-sm text-red-600 hover:underline"
                        >
                          삭제
                        </ConfirmSubmitButton>
                      </form>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          새 수술 종류 추가
        </h3>
        <SurgeryTypeFieldBuilder />
      </div>
    </div>
  );
}
