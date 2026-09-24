"use client";

import { TapButton } from "@/components/tap-button";
import { useRef, useState } from "react";
import type { FieldValues } from "@/lib/field-types";
import type { PlanSideMatrixRow } from "@/lib/op-note-generator";
import { SideMatrixTable } from "@/components/plan-table";

const SIDE_OPTIONS = ["우측", "양측", "좌측"] as const;

type PresentSidedFinding = {
  presentKey: string;
  sideKey: string;
  label: string;
  defaultSide: string;
};

// Concha bullosa/Low skull base는 대부분 양측 소견이라 defaultSide로
// "양측"을 미리 골라두고, 나머지(비대칭인 경우가 많은 소견)는 방향을
// 직접 고르게 defaultSide 없이 둔다.
const ESS_RISK_FINDINGS: PresentSidedFinding[] = [
  { presentKey: "n_cb_present", sideKey: "n_cb_side", label: "Concha bullosa", defaultSide: "양측" },
  {
    presentKey: "n_skull_base_risk_present",
    sideKey: "n_skull_base_risk_side",
    label: "Low skull base",
    defaultSide: "양측",
  },
  { presentKey: "n_onodi_present", sideKey: "n_onodi_side", label: "Onodi's cell", defaultSide: "" },
  { presentKey: "n_haller_present", sideKey: "n_haller_side", label: "Haller's cell", defaultSide: "" },
  {
    presentKey: "n_lp_dehiscence_present",
    sideKey: "n_lp_dehiscence_side",
    label: "Lamina papyracea 결손",
    defaultSide: "",
  },
  {
    presentKey: "n_dehiscence_present",
    sideKey: "n_dehiscence_side",
    label: "시신경/경동맥 골 결손",
    defaultSide: "",
  },
];

// 해부학적 이상 소견과는 별개로, 염증(부비동염) 소견도 남긴다 — Op Plan의
// FESS 시행 부위 표와 똑같이 부비동 × 좌/우 체크 모양으로 둬서, 체크하면
// 그 부비동의 시행 부위도 자동으로 이어서 제안되게 한다(상위인
// surgery-planner.tsx가 SINUSITIS_TO_FESS_FIELD로 처리).
const SINUSITIS_TYPES = [
  { key: "frontal", label: "Frontal sinusitis" },
  { key: "ant_ethmoid", label: "Ant. Ethmoid sinusitis" },
  { key: "post_ethmoid", label: "Post. Ethmoid sinusitis" },
  { key: "maxillary", label: "Maxillary sinusitis" },
  { key: "sphenoid", label: "Sphenoid sinusitis" },
] as const;

export const SINUSITIS_FIELD_KEYS = SINUSITIS_TYPES.flatMap((t) => [
  `n_sinusitis_${t.key}_right`,
  `n_sinusitis_${t.key}_left`,
]);

export const ESS_FINDINGS_FIELD_KEYS = [...ESS_RISK_FINDINGS.flatMap((f) => [f.presentKey, f.sideKey]), ...SINUSITIS_FIELD_KEYS];

// 간략 정보 카드(NasalFindingsOverview)에서 이 그룹이 "있다"고 볼 근거이자,
// 그룹을 접을 때 꺼야 할 체크박스 키들.
export const ANATOMIC_RISK_PRESENT_KEYS = ESS_RISK_FINDINGS.map((f) => f.presentKey);
export const SINUSITIS_PRESENT_KEYS = SINUSITIS_FIELD_KEYS;

function findForm(el: HTMLElement | null): HTMLFormElement | null {
  return el?.closest("form") ?? null;
}

function getInput(form: HTMLFormElement | null, name: string) {
  if (!form) return null;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el : null;
}

// "문제 있는지 체크 → 있으면 방향만 선택" 2단계 입력을 공유하는 소견
// 목록(해부학적 이상 소견/부비동염)이 쓰는 공통 렌더러 — 그룹 전체를 보여줄지
// 말지는 이 컴포넌트가 아니라 상위(NasalFindingsOverview)가 결정한다.
function PresentSidedGroup({
  title,
  findings,
  values,
  onChange,
}: {
  title: string;
  findings: PresentSidedFinding[];
  values?: FieldValues;
  onChange?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Record<string, { present: boolean; side: string }>>(() => {
    const init: Record<string, { present: boolean; side: string }> = {};
    for (const f of findings) {
      init[f.presentKey] = {
        present: values?.[f.presentKey] === true,
        side:
          typeof values?.[f.sideKey] === "string" && values[f.sideKey]
            ? (values[f.sideKey] as string)
            : f.defaultSide,
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
      <p className="mb-2 text-xs font-medium text-slate-600">{title}</p>
      <div className="space-y-2">
        {findings.map((f) => {
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
                    <TapButton
                      key={side}
                      onTap={() => pickSide(f.presentKey, f.sideKey, side)}
                      className={`rounded-full border px-3 py-2 text-xs ${
                        entry.side === side
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {side}
                    </TapButton>
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

export function AnatomicRiskFindingsPicker({
  values,
  onChange,
}: {
  values?: FieldValues;
  onChange?: () => void;
}) {
  return (
    <PresentSidedGroup
      title="ESS 대비 이상 소견 (문제 있는 것만 체크)"
      findings={ESS_RISK_FINDINGS}
      values={values}
      onChange={onChange}
    />
  );
}

// Op Plan의 FESS 시행 부위 표와 같은 2칸(우측/좌측) 표 모양으로 통일한다 —
// 이 컴포넌트는 자체 상태 없이 상위가 넘겨주는 값을 그대로 그리고, 클릭은
// onToggle로 그대로 올려보낸다(상위가 cascade까지 처리).
export function SinusitisFindingsPicker({
  values,
  interactive = true,
  onToggle,
}: {
  values?: FieldValues;
  interactive?: boolean;
  onToggle?: (fieldKey: string) => void;
}) {
  const rows: PlanSideMatrixRow[] = SINUSITIS_TYPES.map((t) => ({
    key: t.key,
    label: t.label,
    right: values?.[`n_sinusitis_${t.key}_right`] === true,
    left: values?.[`n_sinusitis_${t.key}_left`] === true,
    rightFieldKey: `n_sinusitis_${t.key}_right`,
    leftFieldKey: `n_sinusitis_${t.key}_left`,
  }));
  return (
    <SideMatrixTable title="부비동염(Sinusitis) 소견" rows={rows} interactive={interactive} onToggle={onToggle} />
  );
}
