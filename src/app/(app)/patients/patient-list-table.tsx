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
  { key: "age", label: "성별/나이" },
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

// "2026-09-19" -> "26-09-19" — 연도 앞 두 자리를 빼서 열 폭을 줄인다.
function shortDate(d: string | null): string | null {
  if (!d) return null;
  return d.length === 10 ? d.slice(2) : d;
}

function sexAgeLabel(sex: string | null, age: number | null): string {
  if (!sex && age == null) return "-";
  return `${sex ?? "-"}/${age ?? "-"}`;
}

// 이름을 누르면 이력 화면 대신 바로 인쇄용 화면으로 간다 — 기록지가 있으면
// 기록지 인쇄용, 없으면 계획 인쇄용, 계획조차 없으면 환자 상세로 보낸다.
function patientPrintHref(p: PatientRow): string {
  if (p.recordId) return `/records/${p.recordId}/print`;
  if (p.surgeryPlanId) return `/plans/${p.surgeryPlanId}/print`;
  return `/patients/${p.id}`;
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

      {/* 모바일에서는 표가 옆으로 길어져 스크롤해야 하는 문제가 있어서, 한
          화면 안에 다 들어오는 카드형 목록으로 대신 보여준다. */}
      <div className="space-y-2 sm:hidden">
        {patients.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="ids"
                  value={p.id}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Link href={patientPrintHref(p)} className="font-medium text-slate-900 hover:underline">
                  {p.name}
                </Link>
                <span className="text-xs text-slate-500">
                  {sexAgeLabel(p.sex, p.age)} · {p.chartNo ?? "-"}
                </span>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{shortDate(p.surgeryDate) ?? "-"}</span>
            </div>
            <div className="mt-1.5 text-sm">
              {p.surgeryPlanId ? (
                <Link href={`/plans/${p.surgeryPlanId}`} className="font-medium text-slate-900 hover:underline">
                  {p.procedureName ? (p.recordId ? p.procedureName : `예정) ${p.procedureName}`) : "계획 보기"}
                </Link>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              {p.surgeryPlanId ? (
                <Link
                  href={`/plans/${p.surgeryPlanId}`}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  비강 소견 확인
                </Link>
              ) : null}
              {p.recordId ? (
                <Link
                  href={`/records/${p.recordId}`}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  수술기록 확인
                </Link>
              ) : p.surgeryPlanId ? (
                <Link
                  href={`/plans/${p.surgeryPlanId}/record`}
                  className="rounded-md border border-emerald-600 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                >
                  수술기록 확인
                </Link>
              ) : null}
            </div>
          </div>
        ))}
        {patients.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-slate-400">
            등록된 환자가 없습니다.
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="w-10 px-4 py-2">
                <input type="checkbox" onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" />
              </th>
              <th className="w-12 px-2 py-2 font-medium whitespace-nowrap">순번</th>
              {SORT_COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-2 font-medium whitespace-nowrap">
                  <Link href={buildSortHref(query, sort, dir, col.key)} className="hover:underline">
                    {col.label}
                    {sort === col.key && <span className="ml-1">{dir === "asc" ? "▲" : "▼"}</span>}
                  </Link>
                </th>
              ))}
              <th className="px-4 py-2 font-medium whitespace-nowrap">수술명</th>
              {/* 비강 소견/기록지는 열 대신 오른쪽 끝 버튼 두 개로 뺐다 — 표가
                  너무 넓어지는 걸 막고, 계획과 기록지 확인을 핵심 동작으로
                  강조하기 위함. */}
              <th className="px-4 py-2 font-medium whitespace-nowrap" colSpan={2} />
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
                <td className="px-4 py-2 whitespace-nowrap">
                  <Link href={patientPrintHref(p)} className="font-medium text-slate-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{sexAgeLabel(p.sex, p.age)}</td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{p.chartNo ?? "-"}</td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                  {p.surgeryPlanId ? (
                    <Link href={`/plans/${p.surgeryPlanId}`} className="hover:underline">
                      {shortDate(p.surgeryDate) ?? "입력"}
                    </Link>
                  ) : (
                    (shortDate(p.surgeryDate) ?? "-")
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {p.surgeryPlanId ? (
                    <Link href={`/plans/${p.surgeryPlanId}`} className="font-medium text-slate-900 hover:underline">
                      {p.procedureName ? (p.recordId ? p.procedureName : `예정) ${p.procedureName}`) : "계획 보기"}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {p.surgeryPlanId ? (
                    <Link
                      href={`/plans/${p.surgeryPlanId}`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      비강 소견 확인
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {p.recordId ? (
                    <Link
                      href={`/records/${p.recordId}`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      수술기록 확인
                    </Link>
                  ) : p.surgeryPlanId ? (
                    <Link
                      href={`/plans/${p.surgeryPlanId}/record`}
                      className="rounded-md border border-emerald-600 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                    >
                      수술기록 확인
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
