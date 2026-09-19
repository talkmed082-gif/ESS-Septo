"use client";

import { useRef, useState } from "react";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";

function findForm(el: HTMLElement | null): HTMLFormElement | null {
  return el?.closest("form") ?? null;
}

function getSelect(form: HTMLFormElement | null, name: string) {
  if (!form) return null;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLSelectElement ? el : null;
}

// UP attach(우측/좌측)를 한 줄에 나란히 보여주고, 좌우가 같은 경우가 많아
// 한쪽 선택을 반대쪽에 그대로 복사할 수 있는 버튼을 둔다.
export function UncinateAttachmentFields({
  fields,
  values,
  onChange,
}: {
  fields: SurgeryFieldDef[];
  values?: FieldValues;
  onChange?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rightField = fields.find((f) => f.key === "n_uncinate_right");
  const leftField = fields.find((f) => f.key === "n_uncinate_left");
  const [right, setRight] = useState<string>(
    (typeof values?.n_uncinate_right === "string" && values.n_uncinate_right) ||
      rightField?.default ||
      "",
  );
  const [left, setLeft] = useState<string>(
    (typeof values?.n_uncinate_left === "string" && values.n_uncinate_left) ||
      leftField?.default ||
      "",
  );

  function copy(from: "right" | "left") {
    const form = findForm(rootRef.current);
    if (from === "right") {
      setLeft(right);
      const el = getSelect(form, "field_n_uncinate_left");
      if (el) el.value = right;
    } else {
      setRight(left);
      const el = getSelect(form, "field_n_uncinate_right");
      if (el) el.value = left;
    }
    onChange?.();
  }

  if (!rightField || !leftField) return null;

  return (
    <div ref={rootRef} className="rounded-md border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">UP attach</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => copy("right")}
            className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            우→좌 동일
          </button>
          <button
            type="button"
            onClick={() => copy("left")}
            className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            좌→우 동일
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">{rightField.label}</label>
          <select
            name="field_n_uncinate_right"
            value={right}
            onChange={(e) => {
              setRight(e.target.value);
              onChange?.();
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">선택 안 함</option>
            {(rightField.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">{leftField.label}</label>
          <select
            name="field_n_uncinate_left"
            value={left}
            onChange={(e) => {
              setLeft(e.target.value);
              onChange?.();
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">선택 안 함</option>
            {(leftField.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
