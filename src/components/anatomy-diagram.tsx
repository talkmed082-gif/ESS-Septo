"use client";

import { useRef, useState } from "react";
import type { FieldValues } from "@/lib/field-types";

const SINUS_STEPS: { key: string; label: string }[] = [
  { key: "frontal", label: "Frontal" },
  { key: "ant_eth", label: "Ant. Ethmoid" },
  { key: "post_eth", label: "Post. Ethmoid" },
  { key: "sphenoid", label: "Sphenoid" },
  { key: "mma", label: "Maxillary" },
];

// 모식도가 대신 담당하는 필드 키 목록 — 같은 항목이 아래 체크리스트에도 중복으로
// 나타나 두 입력 방식이 서로 어긋나 보이는 것("원활하지 않음")을 막기 위해,
// 이 키들은 SurgeryFieldInputs 목록에서는 제외하고 모식도에서만 선택하게 한다.
export function getAnatomyCoveredKeys(surgeryTypeCode: string): string[] {
  const keys: string[] = [];
  const showSeptum =
    surgeryTypeCode === "SEPTOPLASTY" || surgeryTypeCode === "ESS" || surgeryTypeCode === "COMBO";
  const showSinus = surgeryTypeCode === "ESS" || surgeryTypeCode === "COMBO";

  if (showSeptum) keys.push("n_dev_side");
  if (showSinus) {
    for (const prefix of ["f_left_", "f_right_"] as const) {
      for (const step of SINUS_STEPS) keys.push(`${prefix}${step.key}`);
    }
  }
  return keys;
}

function findForm(el: HTMLElement | null): HTMLFormElement | null {
  return el?.closest("form") ?? null;
}

function getInput(form: HTMLFormElement | null, name: string) {
  if (!form) return null;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el : null;
}

export function SeptumDiagram({
  values,
  onChange,
}: {
  values?: FieldValues;
  onChange?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = values?.n_dev_side;
  const [side, setSide] = useState<string>(
    typeof initial === "string" && initial ? initial : "특이 만곡 없음",
  );

  function pick(value: string) {
    const form = findForm(rootRef.current);
    const el = getInput(form, "field_n_dev_side");
    if (el) el.value = value;
    setSide(value);
    onChange?.();
  }

  const zone = (label: string, value: string, x: number) => {
    const active = side === value || (value !== "특이 만곡 없음" && side === "양측(C자형)");
    return (
      <g
        onClick={() => pick(side === value ? "특이 만곡 없음" : value)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x={x}
          y={10}
          width={70}
          height={60}
          rx={8}
          fill={active ? "#059669" : "#f1f5f9"}
          stroke={active ? "#047857" : "#cbd5e1"}
          strokeWidth={1.5}
        />
        <text
          x={x + 35}
          y={44}
          textAnchor="middle"
          fontSize="11"
          fill={active ? "#fff" : "#334155"}
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <div ref={rootRef} className="rounded-md border border-slate-200 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">
        비중격 편위 방향 (클릭해서 선택 · 다시 누르면 해제)
      </p>
      <svg viewBox="0 0 220 80" className="w-full max-w-xs">
        {zone("좌측", "좌측", 5)}
        <rect x={80} y={10} width={60} height={60} rx={8} fill="#e2e8f0" stroke="#94a3b8" />
        <text x={110} y={40} textAnchor="middle" fontSize="10" fill="#64748b">
          비중격
        </text>
        <text x={110} y={54} textAnchor="middle" fontSize="9" fill="#94a3b8">
          (Septum)
        </text>
        {zone("우측", "우측", 145)}
      </svg>
      <button
        type="button"
        onClick={() => pick(side === "양측(C자형)" ? "특이 만곡 없음" : "양측(C자형)")}
        className={`mt-2 rounded-full border px-3 py-1 text-xs ${
          side === "양측(C자형)"
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-slate-300 text-slate-600 hover:bg-slate-50"
        }`}
      >
        양측(C자형)
      </button>
    </div>
  );
}

export function SinusDiagram({
  values,
  onChange,
}: {
  values?: FieldValues;
  onChange?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const prefix of ["f_left_", "f_right_"] as const) {
      for (const step of SINUS_STEPS) {
        next[`${prefix}${step.key}`] = values?.[`${prefix}${step.key}`] === true;
      }
    }
    return next;
  });

  function toggle(prefix: "f_left_" | "f_right_", key: string) {
    const form = findForm(rootRef.current);
    const name = `field_${prefix}${key}`;
    const el = getInput(form, name);
    const nextVal = !checked[`${prefix}${key}`];
    if (el instanceof HTMLInputElement) el.checked = nextVal;
    setChecked((c) => ({ ...c, [`${prefix}${key}`]: nextVal }));
    onChange?.();
  }

  const column = (prefix: "f_left_" | "f_right_", label: string) => (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex flex-col gap-1">
        {SINUS_STEPS.map((s) => {
          const active = checked[`${prefix}${s.key}`];
          return (
            <button
              type="button"
              key={s.key}
              onClick={() => toggle(prefix, s.key)}
              className={`w-24 rounded-md border px-2 py-1.5 text-[11px] leading-tight ${
                active
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="rounded-md border border-slate-200 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">
        부비동 시행 부위 (좌/우 각각 클릭해서 선택)
      </p>
      <div className="flex items-start justify-center gap-8">
        {column("f_left_", "좌측 (Lt.)")}
        {column("f_right_", "우측 (Rt.)")}
      </div>
    </div>
  );
}

export function AnatomyPicker({
  surgeryTypeCode,
  values,
  onChange,
}: {
  surgeryTypeCode: string;
  values?: FieldValues;
  onChange?: () => void;
}) {
  const showSeptum =
    surgeryTypeCode === "SEPTOPLASTY" || surgeryTypeCode === "ESS" || surgeryTypeCode === "COMBO";
  const showSinus = surgeryTypeCode === "ESS" || surgeryTypeCode === "COMBO";

  if (!showSeptum && !showSinus) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {showSeptum && <SeptumDiagram values={values} onChange={onChange} />}
      {showSinus && <SinusDiagram values={values} onChange={onChange} />}
    </div>
  );
}
