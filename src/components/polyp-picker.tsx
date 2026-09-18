"use client";

import { useRef, useState } from "react";
import type { FieldValues } from "@/lib/field-types";

const POLYP_SIDES = ["없음", "우측", "좌측", "양측"] as const;

const POLYP_SITE_FIELDS = [
  { key: "n_polyp_site_mm", label: "중비도" },
  { key: "n_polyp_site_ethmoid", label: "사골동" },
  { key: "n_polyp_site_maxillary", label: "상악동 자연공" },
  { key: "n_polyp_site_sphenoid", label: "접형동" },
  { key: "n_polyp_site_choana", label: "후비공까지 연장" },
] as const;

// 모식도(AnatomyPicker)와 마찬가지로 이 컴포넌트가 대신 입력을 담당하는 필드 —
// SurgeryFieldInputs 목록에서는 제외하고 여기서만 선택하게 한다.
export const POLYP_FIELD_KEYS = ["n_polyp_side", ...POLYP_SITE_FIELDS.map((f) => f.key)];

function findForm(el: HTMLElement | null): HTMLFormElement | null {
  return el?.closest("form") ?? null;
}

function getInput(form: HTMLFormElement | null, name: string) {
  if (!form) return null;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el : null;
}

export function PolypPicker({
  values,
  onChange,
}: {
  values?: FieldValues;
  onChange?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const initialSide = values?.n_polyp_side;
  const [side, setSide] = useState<string>(
    typeof initialSide === "string" && initialSide ? initialSide : "없음",
  );
  const [sites, setSites] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const f of POLYP_SITE_FIELDS) next[f.key] = values?.[f.key] === true;
    return next;
  });

  function pickSide(value: string) {
    setSide(value);
    onChange?.();
    requestAnimationFrame(() => {
      const form = findForm(rootRef.current);
      const el = getInput(form, "field_n_polyp_side");
      if (el) el.value = value;
    });
  }

  function toggleSite(key: string) {
    setSites((s) => {
      const nextVal = !s[key];
      requestAnimationFrame(() => {
        const form = findForm(rootRef.current);
        const el = getInput(form, `field_${key}`);
        if (el instanceof HTMLInputElement) el.checked = nextVal;
      });
      return { ...s, [key]: nextVal };
    });
    onChange?.();
  }

  return (
    <div ref={rootRef} className="rounded-md border border-slate-200 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">비용종(Polyp) 소견</p>
      <div className="flex flex-wrap gap-2">
        {POLYP_SIDES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pickSide(s)}
            className={`min-h-[36px] touch-manipulation rounded-full border px-3 py-1.5 text-xs active:scale-95 ${
              side === s
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {side !== "없음" && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs text-slate-500">위치 선택 (해당하는 곳 모두 선택)</p>
          <div className="flex flex-wrap gap-2">
            {POLYP_SITE_FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleSite(f.key)}
                className={`min-h-[36px] touch-manipulation rounded-md border px-3 py-1.5 text-xs active:scale-95 ${
                  sites[f.key]
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
