"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { deletePatients } from "@/app/actions/patients";

export interface PatientRow {
  id: string;
  name: string;
  chartNo: string | null;
  sex: string | null;
  age: number | null;
  surgeryDate: string | null;
  surgeryPlanId: string | null;
  procedureName: string | null;
  nasalFindings: string | null;
  recordId: string | null;
}

const SORT_COLUMNS: { key: string; label: string }[] = [
  { key: "name", label: "이름" },
  { key: "sex", label: "성별" },
  { key: "age", label: "나이" },
  { key: "chartNo", label: "차트번호" },
  { key: "surgeryDate", label: "수술 일자" },
];

function buildSortHref(query: string, sort: string, dir: string, column: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("sort", column);
  params.set("dir", sort === column && dir === "asc" ? "desc" : "asc");
  return `/patients?${params.toString()}`;
}

export function PatientListTable({
  patients,
  query,
  sort,
  dir,
}: {
  patients: PatientRow[];
  query: string;
  sort: string;
  dir: string;
}) {
  const [, formAction, pending] = useActionState(deletePatients, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    const form = formRef.current;
    if (!form) return;
    form.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((cb) => {
      cb.checked = e.target.checked;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const checked = formRef.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked');
    if (!checked || checked.length === 0) {
      e.preventDefault();
      return;
    }
    if (!window.confirm(`선택한 환자 ${checked.length}명을 삭제할까요? 관련 수술계획/기록지도 함께 삭제됩니다.`)) {
      e.preventDefault();
    }
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">체크 후 선택 삭제를 누르면 일괄 삭제됩니다.</p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {pending ? "삭제 중..." : "선택 삭제"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="w-10 px-4 py-2">
                <input type="checkbox" onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" />
              </th>
              <th className="w-12 px-2 py-2 font-medium">순번</th>
              {SORT_COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-2 font-medium">
                  <Link href={buildSortHref(query, sort, dir, col.key)} className="hover:underline">
                    {col.label}
                    {sort === col.key && <span className="ml-1">{dir === "asc" ? "▲" : "▼"}</span>}
                  </Link>
                </th>
              ))}
              {/* 계획과 기록지 두 가지를 이 목록의 핵심 기능으로 삼아, 비강 소견 -
                  계획 - 기록지 순서로 나란히 배치한다 (기록지는 맨 오른쪽). */}
              <th className="px-4 py-2 font-medium">비강 소견</th>
              <th className="px-4 py-2 font-medium">계획</th>
              <th className="px-4 py-2 font-medium">기록지</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p, idx) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    name="ids"
                    value={p.id}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </td>
                <td className="px-2 py-2 text-slate-400">{idx + 1}</td>
                <td className="px-4 py-2">
                  <Link href={`/patients/${p.id}`} className="font-medium text-slate-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {p.sex === "M" ? "남" : p.sex === "F" ? "여" : "-"}
                </td>
                <td className="px-4 py-2 text-slate-600">{p.age ?? "-"}</td>
                <td className="px-4 py-2 text-slate-600">{p.chartNo ?? "-"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {p.surgeryPlanId ? (
                    <Link href={`/plans/${p.surgeryPlanId}`} className="hover:underline">
                      {p.surgeryDate ?? "입력"}
                    </Link>
                  ) : (
                    (p.surgeryDate ?? "-")
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-slate-600" title={p.nasalFindings ?? undefined}>
                  {p.nasalFindings ?? "-"}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {p.surgeryPlanId ? (
                    <Link href={`/plans/${p.surgeryPlanId}`} className="font-medium text-slate-900 hover:underline">
                      {p.procedureName ?? "계획 보기"}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {p.recordId ? (
                    <Link href={`/records/${p.recordId}`} className="font-medium text-slate-900 hover:underline">
                      기록지 보기
                    </Link>
                  ) : p.surgeryPlanId ? (
                    <Link href={`/plans/${p.surgeryPlanId}/record`} className="text-emerald-700 hover:underline">
                      기록지 작성
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  등록된 환자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}
