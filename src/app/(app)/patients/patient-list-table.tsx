"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useOptimistic, useRef, useTransition } from "react";
import { deletePatients } from "@/app/actions/patients";
import { toggleOpPlanDone } from "@/app/actions/op-plans";
import { buttonStyles } from "@/lib/ui";
import type { PatientRow } from "./patient-row";

export type { PatientRow };

function procedureLabel(p: PatientRow): string {
  return p.procedureName ?? "계획 보기";
}

// 예정/완료 상태를 순번 옆 한 곳에서만 보여준다 — 예전엔 수술명 뒤에
// 체크박스를 붙여서 시선이 이리저리 흩어졌다.
function StatusBadge({ p, onToggle }: { p: PatientRow; onToggle: (planId: string) => void }) {
  if (!p.surgeryPlanId) return <span className="text-xs text-slate-300">-</span>;
  if (p.recordId) {
    return (
      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        완료
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onToggle(p.surgeryPlanId as string)}
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        p.planDone
          ? "bg-slate-100 text-slate-500"
          : "border border-amber-300 bg-amber-50 text-amber-700"
      }`}
    >
      {p.planDone ? "완료" : "예정"}
    </button>
  );
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

// 이름/성별·나이/차트번호/수술일자를 누르면 그 환자의 기본 화면(계획+
// 기록지가 다 보이는 허브)으로 간다 — 정보 수정은 그 화면 안의 "정보 수정"
// 버튼으로 들어가고 저장하면 다시 이 화면으로 돌아온다. 계획 자체를 보거나
// 고치려면 수술명을, 비강 소견/기록지를 확인하려면 오른쪽 끝 버튼을
// 누르면 되므로 서로 목적이 겹치지 않는다.
function patientHubHref(p: PatientRow): string {
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
  const router = useRouter();
  const [, startTransition] = useTransition();
  // 완료 체크는 서버 왕복이 끝나야 반영되면 클릭해도 잠깐 반응이 없는 것처럼
  // 보여서, 클릭 즉시 화면에 반영(낙관적 업데이트)하고 뒤에서 실제 저장한다.
  const [optimisticPatients, setOptimisticDone] = useOptimistic(
    patients,
    (state, planId: string) =>
      state.map((p) => (p.surgeryPlanId === planId ? { ...p, planDone: !p.planDone } : p)),
  );

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

  // 체크한 환자들의 최신 수술 계획을 모아 수술방 체크리스트 양식에 채워서
  // 인쇄한다 (A4 한 장에 4개 — 부족하면 나머지는 빈 칸으로 나온다).
  function printOpPlans() {
    const checked = formRef.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked');
    const checkedIds = new Set(Array.from(checked ?? []).map((el) => el.value));
    const planIds = patients
      .filter((p) => checkedIds.has(p.id) && p.surgeryPlanId)
      .map((p) => p.surgeryPlanId as string);
    if (planIds.length === 0) {
      window.alert("수술 계획이 있는 환자를 먼저 선택하세요.");
      return;
    }
    router.push(`/print/fess-checklist?plans=${planIds.join(",")}`);
  }

  function handleToggleDone(planId: string) {
    startTransition(async () => {
      setOptimisticDone(planId);
      await toggleOpPlanDone(planId);
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">체크 후 선택 삭제를 누르면 일괄 삭제됩니다.</p>
        <div className="flex gap-2">
          <button type="button" onClick={printOpPlans} className={buttonStyles.secondarySmall}>
            선택한 환자 Op Plan 인쇄
          </button>
          <button type="submit" disabled={pending} className={buttonStyles.danger}>
            {pending ? "삭제 중..." : "선택 삭제"}
          </button>
        </div>
      </div>

      {/* 모바일에서는 표가 옆으로 길어져 스크롤해야 하는 문제가 있어서, 한
          화면 안에 다 들어오는 카드형 목록으로 대신 보여준다. */}
      <div className="space-y-2 sm:hidden">
        {optimisticPatients.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="ids"
                  value={p.id}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <StatusBadge p={p} onToggle={handleToggleDone} />
                <Link href={patientHubHref(p)} className="font-medium text-slate-900 hover:underline">
                  {p.name}
                </Link>
                <Link href={patientHubHref(p)} className="text-xs text-slate-500 hover:underline">
                  {sexAgeLabel(p.sex, p.age)} · {p.chartNo ?? "-"}
                </Link>
              </div>
              <Link href={patientHubHref(p)} className="shrink-0 text-xs text-slate-400 hover:underline">
                {shortDate(p.surgeryDate) ?? "-"}
              </Link>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              {p.surgeryPlanId ? (
                <Link href={`/plans/${p.surgeryPlanId}`} className="font-medium text-slate-900 hover:underline">
                  {procedureLabel(p)}
                </Link>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              {p.surgeryPlanId ? (
                <Link href={`/plans/${p.surgeryPlanId}/print`} className={buttonStyles.smallOutline}>
                  수술 계획 확인
                </Link>
              ) : null}
              {p.recordId ? (
                <Link href={`/records/${p.recordId}`} className={buttonStyles.smallOutline}>
                  수술기록 확인
                </Link>
              ) : p.surgeryPlanId ? (
                <Link href={`/plans/${p.surgeryPlanId}/record`} className={buttonStyles.smallOutlineAccent}>
                  수술기록 확인
                </Link>
              ) : null}
            </div>
          </div>
        ))}
        {optimisticPatients.length === 0 && (
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
              <th className="px-2 py-2 font-medium whitespace-nowrap">상태</th>
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
            {optimisticPatients.map((p, idx) => (
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
                <td className="px-2 py-2 whitespace-nowrap">
                  <StatusBadge p={p} onToggle={handleToggleDone} />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <Link href={patientHubHref(p)} className="font-medium text-slate-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                  <Link href={patientHubHref(p)} className="hover:underline">
                    {sexAgeLabel(p.sex, p.age)}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                  <Link href={patientHubHref(p)} className="hover:underline">
                    {p.chartNo ?? "-"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                  <Link href={patientHubHref(p)} className="hover:underline">
                    {shortDate(p.surgeryDate) ?? "-"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {p.surgeryPlanId ? (
                    <Link href={`/plans/${p.surgeryPlanId}`} className="font-medium text-slate-900 hover:underline">
                      {procedureLabel(p)}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {p.surgeryPlanId ? (
                    <Link href={`/plans/${p.surgeryPlanId}/print`} className={buttonStyles.smallOutline}>
                      수술 계획 확인
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {p.recordId ? (
                    <Link href={`/records/${p.recordId}`} className={buttonStyles.smallOutline}>
                      수술기록 확인
                    </Link>
                  ) : p.surgeryPlanId ? (
                    <Link href={`/plans/${p.surgeryPlanId}/record`} className={buttonStyles.smallOutlineAccent}>
                      수술기록 확인
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {optimisticPatients.length === 0 && (
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
