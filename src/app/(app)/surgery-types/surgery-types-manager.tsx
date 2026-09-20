import { prisma } from "@/lib/prisma";
import { deleteSurgeryType, reseedBuiltInSurgeryTypes } from "@/app/actions/surgery-types";
import { parseFieldDefs } from "@/lib/field-types";
import { buttonStyles } from "@/lib/ui";
import { SurgeryTypeFieldBuilder } from "./field-builder";

export async function SurgeryTypesManager({ updated }: { updated?: boolean }) {
  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-4">
      {updated && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          완료: 기본 수술 종류 입력 항목이 최신화되었습니다.
        </p>
      )}

      <form action={reseedBuiltInSurgeryTypes}>
        <button type="submit" className={buttonStyles.secondarySmall}>
          기본 수술 종류(ESS/비중격교정술/병행) 입력 항목 최신화
        </button>
        <p className="mt-1 text-xs text-slate-400">
          op-note-defs.ts 쪽 기본 항목/기본값이 바뀐 뒤 반영이 안 됐을 때 눌러서 DB의 입력 항목 정의를
          다시 맞춥니다. 기존에 저장된 계획/기록지 값은 바뀌지 않습니다.
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
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          새 수술 종류 추가
        </h3>
        <SurgeryTypeFieldBuilder />
      </div>
    </div>
  );
}
