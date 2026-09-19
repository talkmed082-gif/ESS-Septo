"use client";

import { useRef, useState } from "react";
import type { FieldValues } from "@/lib/field-types";

const POLYP_SITE_FIELDS = [
  { key: "site_mm", label: "중비도" },
  { key: "site_ethmoid", label: "사골동" },
  { key: "site_maxillary", label: "상악동 자연공" },
  { key: "site_sphenoid", label: "접형동" },
  { key: "site_choana", label: "후비공까지 연장" },
] as const;

const SIDES = [
  { prefix: "n_polyp_right_", label: "우측 (Rt.)" },
  { prefix: "n_polyp_left_", label: "좌측 (Lt.)" },
] as const;

// 모식도(AnatomyPicker)와 마찬가지로 이 컴포넌트가 대신 입력을 담당하는 필드 —
// SurgeryFieldInputs 목록에서는 제외하고 여기서만 선택하게 한다.
export const POLYP_FIELD_KEYS = SIDES.flatMap((side) =>
  POLYP_SITE_FIELDS.map((f) => `${side.prefix}${f.key}`),
);

function findForm(el: HTMLElement | null): HTMLFormElement | null {
  return el?.closest("form") ?? null;
}

function getInput(form: HTMLFormElement | null, name: string) {
  if (!form) return null;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement ? el : null;
}

// 비용종이 없는 경우가 더 많아, "있음" 체크부터 하고 체크했을 때만 좌/우
// 위치 선택 UI가 나타나게 한다 (ESS 이상소견과 같은 체크 → 상세 패턴).
// 좌/우 정도(위치)가 서로 다른 경우가 많아 공통 "방향" 선택 없이 측별로
// 위치를 각각 고르게 한다 — 위치가 하나라도 체크된 측에 비용종이 있는 것으로 본다.
export function PolypPicker({
  values,
  onChange,
}: {
  values?: FieldValues;
  onChange?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [sites, setSites] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const side of SIDES) {
      for (const f of POLYP_SITE_FIELDS) next[`${side.prefix}${f.key}`] = values?.[`${side.prefix}${f.key}`] === true;
    }
    return next;
  });
  const [present, setPresent] = useState<boolean>(() => Object.values(sites).some(Boolean));

  function clearAllSites() {
    setSites((s) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(s)) next[key] = false;
      requestAnimationFrame(() => {
        const form = findForm(rootRef.current);
        for (const key of Object.keys(s)) {
          const el = getInput(form, `field_${key}`);
          if (el) el.checked = false;
        }
      });
      return next;
    });
  }

  function togglePresent() {
    setPresent((p) => {
      const next = !p;
      if (!next) clearAllSites();
      return next;
    });
    onChange?.();
  }

  function toggleSite(fullKey: string) {
    setSites((s) => {
      const nextVal = !s[fullKey];
      requestAnimationFrame(() => {
        const form = findForm(rootRef.current);
        const el = getInput(form, `field_${fullKey}`);
        if (el) el.checked = nextVal;
      });
      return { ...s, [fullKey]: nextVal };
    });
    onChange?.();
  }

  return (
    <div ref={rootRef} className="rounded-md border border-slate-200 p-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={present}
          onChange={togglePresent}
          className="h-4 w-4 rounded border-slate-300"
        />
        비용종(Polyp) 있음
      </label>
      {present && (
        <div className="mt-3 flex flex-wrap gap-6 border-t border-slate-100 pt-3">
          {SIDES.map((side) => (
            <div key={side.prefix} className="flex flex-col items-start gap-2">
              <span className="text-xs font-medium text-slate-600">{side.label}</span>
              <div className="flex flex-wrap gap-2">
                {POLYP_SITE_FIELDS.map((f) => {
                  const fullKey = `${side.prefix}${f.key}`;
                  return (
                    <button
                      key={fullKey}
                      type="button"
                      onClick={() => toggleSite(fullKey)}
                      className={`min-h-[36px] touch-manipulation rounded-md border px-3 py-1.5 text-xs active:scale-95 ${
                        sites[fullKey]
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
