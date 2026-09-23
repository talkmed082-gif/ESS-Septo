import { prisma } from "@/lib/prisma";
import { deleteSurgeryType, reseedBuiltInSurgeryTypes } from "@/app/actions/surgery-types";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";
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
          기본 3종(ESS/비중격교정술/병행)은 화면·저장 모두 항상 최신 코드 정의를 그대로 쓰므로 평소엔
          안 눌러도 됩니다. 이 버튼은 아래 표에 보이는 DB 저장 값만 최신 코드 정의로 맞춰줍니다.
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
