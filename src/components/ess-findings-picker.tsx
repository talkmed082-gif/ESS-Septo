"use client";

import { useRef, useState } from "react";
import type { FieldValues } from "@/lib/field-types";

const SIDE_OPTIONS = ["좌측", "우측", "양측"] as const;

const ESS_RISK_FINDINGS = [
  { presentKey: "n_cb_present", sideKey: "n_cb_side", label: "Concha bullosa" },
  {
    presentKey: "n_skull_base_risk_present",
    sideKey: "n_skull_base_risk_side",
    label: "위험한(깊은) skull base",
  },
  { presentKey: "n_onodi_present", sideKey: "n_onodi_side", label: "Onodi cell" },
  { presentKey: "n_haller_present", sideKey: "n_haller_side", label: "Haller cell" },
  {
    presentKey: "n_lp_dehiscence_present",
    sideKey: "n_lp_dehiscence_side",
    label: "Lamina papyracea 결손",
  },
  {
    presentKey: "n_dehiscence_present",
    sideKey: "n_dehiscence_side",
    label: "시신경/경동맥 골 결손",
  },
] as const;

export const ESS_FINDINGS_FIELD_KEYS = ESS_RISK_FINDINGS.flatMap((f) => [f.presentKey, f.sideKey]);

function findForm(el: HTMLElement | null): HTMLFormElement | null {
  return el?.closest("form") ?? null;
}

function getInput(form: HTMLFormElement | null, name: string) {
  if (!form) return null;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el : null;
}

// ESS 대비 CT/내시경 이상 소견 6종을 "일단 문제 있는지 체크 → 있으면 방향만
// 선택" 2단계로 입력받는다. 정상(없음)인 경우가 대부분이라 체크 안 하면
// 그대로 넘어가고, 매번 "없음" 옵션까지 훑어볼 필요가 없게 한다.
export function EssFindingsPicker({
  values,
  onChange,
}: {
  values?: FieldValues;
  onChange?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Record<string, { present: boolean; side: string }>>(() => {
    const init: Record<string, { present: boolean; side: string }> = {};
    for (const f of ESS_RISK_FINDINGS) {
      init[f.presentKey] = {
        present: values?.[f.presentKey] === true,
        side: typeof values?.[f.sideKey] === "string" && values[f.sideKey] ? (values[f.sideKey] as string) : "양측",
      };
    }
    return init;
  });

  // DOM의 실제 입력값을 동기적으로 먼저 맞춘 다음 onChange를 불러야 라이브
  // 미리보기가 방금 누른 값을 바로 읽어간다 — 다음 페인트까지 미루면
  // onChange가 그보다 먼저 실행되어 한 클릭씩 뒤처지는 문제가 있었다.
  function togglePresent(presentKey: string) {
    const form = findForm(rootRef.current);
    const el = getInput(form, `field_${presentKey}`);
    const nextPresent = el instanceof HTMLInputElement ? !el.checked : !state[presentKey].present;
    if (el instanceof HTMLInputElement) el.checked = nextPresent;
    setState((s) => ({ ...s, [presentKey]: { ...s[presentKey], present: nextPresent } }));
    onChange?.();
  }

  function pickSide(presentKey: string, sideKey: string, side: string) {
    const form = findForm(rootRef.current);
    const el = getInput(form, `field_${sideKey}`);
    if (el) el.value = side;
    setState((s) => ({ ...s, [presentKey]: { ...s[presentKey], side } }));
    onChange?.();
  }

  return (
    <div ref={rootRef} className="rounded-md border border-slate-200 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">
        ESS 대비 이상 소견 (문제 있는 것만 체크)
      </p>
      <div className="space-y-2">
        {ESS_RISK_FINDINGS.map((f) => {
          const entry = state[f.presentKey];
          return (
            <div key={f.presentKey} className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-[11rem] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={entry.present}
                  onChange={() => togglePresent(f.presentKey)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {f.label}
              </label>
              {entry.present && (
                <div className="flex gap-1.5">
                  {SIDE_OPTIONS.map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => pickSide(f.presentKey, f.sideKey, side)}
                      className={`rounded-full border px-2.5 py-1 text-xs touch-manipulation active:scale-95 ${
                        entry.side === side
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
