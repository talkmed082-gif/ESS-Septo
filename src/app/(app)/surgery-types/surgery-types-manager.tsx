import { prisma } from "@/lib/prisma";
import { deleteSurgeryType } from "@/app/actions/surgery-types";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";
import { SurgeryTypeFieldBuilder } from "./field-builder";

export async function SurgeryTypesManager() {
  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
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
                  {!st.isBuiltIn && (
                    <form action={deleteSurgeryType.bind(null, st.id)}>
                      <button
                        type="submit"
                        className="text-sm text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </form>
                  )}
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
