"use client";

import { useActionState, useState } from "react";
import type { SurgeryFieldDef, SurgeryFieldType } from "@/lib/field-types";
import {
  createSurgeryType,
  type SurgeryTypeFormState,
} from "@/app/actions/surgery-types";

const TYPE_LABEL: Record<SurgeryFieldType, string> = {
  text: "한 줄 텍스트",
  textarea: "여러 줄 텍스트",
  select: "선택(드롭다운)",
  checkbox: "체크박스",
  number: "숫자",
};

let rowIdCounter = 0;

interface Row extends SurgeryFieldDef {
  rowId: number;
}

function emptyRow(): Row {
  rowIdCounter += 1;
  return { rowId: rowIdCounter, key: "", label: "", type: "checkbox" };
}

export function SurgeryTypeFieldBuilder() {
  const [state, formAction, pending] = useActionState<
    SurgeryTypeFormState | undefined,
    FormData
  >(createSurgeryType, undefined);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  function updateRow(rowId: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function removeRow(rowId: number) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  const fieldsJson = JSON.stringify(
    rows
      .filter((r) => r.key.trim() && r.label.trim())
      .map((r) => ({
        key: r.key.trim(),
        label: r.label.trim(),
        type: r.type,
        options:
          r.type === "select"
            ? (r.options ?? []).map((o) => o.trim()).filter(Boolean)
            : undefined,
      })),
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            수술 코드 (영문 대문자) *
          </label>
          <input
            name="code"
            placeholder="예: TONSILLECTOMY"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-slate-500 focus:outline-none"
          />
          {state?.errors?.code && (
            <p className="mt-1 text-sm text-red-600">{state.errors.code[0]}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            수술 이름 *
          </label>
          <input
            name="name"
            placeholder="예: 편도절제술"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {state?.errors?.name && (
            <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">
            입력 항목
          </label>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            + 항목 추가
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.rowId}
              className="flex flex-wrap items-start gap-2 rounded-md border border-slate-200 p-2"
            >
              <input
                placeholder="key (영문, 예: turbinate_r)"
                value={row.key}
                onChange={(e) => updateRow(row.rowId, { key: e.target.value })}
                className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                placeholder="항목 이름 (예: 우측 하비갑개)"
                value={row.label}
                onChange={(e) => updateRow(row.rowId, { label: e.target.value })}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <select
                value={row.type}
                onChange={(e) =>
                  updateRow(row.rowId, {
                    type: e.target.value as SurgeryFieldType,
                  })
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {row.type === "select" && (
                <input
                  placeholder="선택지 (쉼표로 구분)"
                  value={(row.options ?? []).join(", ")}
                  onChange={(e) =>
                    updateRow(row.rowId, {
                      options: e.target.value.split(","),
                    })
                  }
                  className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              )}
              <button
                type="button"
                onClick={() => removeRow(row.rowId)}
                className="text-sm text-red-600 hover:underline"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>

      <input type="hidden" name="fieldsJson" value={fieldsJson} />
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "수술 종류 추가"}
      </button>
    </form>
  );
}
