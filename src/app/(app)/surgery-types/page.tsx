import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { deleteSurgeryType, reseedBuiltInSurgeryTypes } from "@/app/actions/surgery-types";
import { parseFieldDefs } from "@/lib/field-types";
import { SurgeryTypeFieldBuilder } from "./field-builder";

export default async function SurgeryTypesPage() {
  await verifySession();
  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">수술 종류 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          기본 제공되는 ESS/비중격교정술 외에, 다루는 이비인후과 수술을 자유롭게
          추가할 수 있습니다.
        </p>
      </div>

      <form action={reseedBuiltInSurgeryTypes}>
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          기본 수술 종류(ESS/비중격교정술/병행) 입력 항목 최신화
        </button>
        <p className="mt-1 text-xs text-slate-400">
          코드에 새로 추가된 입력 항목을 반영합니다. 기존에 저장된 계획/기록지 값은 바뀌지 않습니다.
        </p>
      </form>

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
                  {parseFieldDefs(st.fields).length}개
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
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          새 수술 종류 추가
        </h2>
        <SurgeryTypeFieldBuilder />
      </div>
    </div>
  );
}
