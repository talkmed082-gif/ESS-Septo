"use client";

import { useState } from "react";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";

// UP attach(우측/좌측)를 한 줄에 나란히 보여준다.
export function UncinateAttachmentFields({
  fields,
  values,
  onChange,
}: {
  fields: SurgeryFieldDef[];
  values?: FieldValues;
  onChange?: () => void;
}) {
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

  if (!rightField || !leftField) return null;

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <span className="mb-2 block text-xs font-medium text-slate-600">UP attach</span>
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
