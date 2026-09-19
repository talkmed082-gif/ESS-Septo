"use client";

import { useRef, useState } from "react";
import type { FieldValues } from "@/lib/field-types";
import { fessStepFieldKeys } from "@/lib/op-note-defs";

// 모식도의 순서를 Op Plan 표/기록지 서술 순서(fessStepFieldKeys)와 똑같이
// 맞춘다 — 예전엔 이 컴포넌트가 별도의 순서(Frontal이 맨 위)를 갖고 있어서
// 모식도에서 누르는 순서와 표/기록지에 나오는 순서(Maxillary가 먼저,
// Frontal이 마지막인 실제 수술 순서)가 서로 달라 "뒤죽박죽"으로 보였다.
const SINUS_STEP_LABELS: Record<(typeof fessStepFieldKeys)[number], string> = {
  mma: "Maxillary",
  ant_eth: "Ant. Ethmoid",
  post_eth: "Post. Ethmoid",
  sphenoid: "Sphenoid",
  frontal: "Frontal",
};
const SINUS_STEPS: { key: string; label: string }[] = fessStepFieldKeys.map((key) => ({
  key,
  label: SINUS_STEP_LABELS[key],
}));

// 수술 종류별로 SeptumDiagram(비강 소견 페이지용)과 SinusDiagram(수술 방법
// 페이지용)을 각각 보여줄지 판단하는 공통 기준
export function getAnatomyVisibility(surgeryTypeCode: string): {
  showSeptum: boolean;
  showSinus: boolean;
} {
  return {
    showSeptum:
      surgeryTypeCode === "SEPTOPLASTY" || surgeryTypeCode === "ESS" || surgeryTypeCode === "COMBO",
    showSinus: surgeryTypeCode === "ESS" || surgeryTypeCode === "COMBO",
  };
}

// 모식도가 대신 담당하는 필드 키 목록 — 같은 항목이 아래 체크리스트에도 중복으로
// 나타나 두 입력 방식이 서로 어긋나 보이는 것("원활하지 않음")을 막기 위해,
// 이 키들은 SurgeryFieldInputs 목록에서는 제외하고 모식도에서만 선택하게 한다.
export function getAnatomyCoveredKeys(surgeryTypeCode: string): string[] {
  const keys: string[] = [];
  const { showSeptum, showSinus } = getAnatomyVisibility(surgeryTypeCode);

  if (showSeptum) keys.push("n_dev_side");
  if (showSinus) {
    keys.push("f_revision");
    for (const prefix of ["f_left_", "f_right_"] as const) {
      keys.push(`${prefix}uncinectomy`);
      for (const step of SINUS_STEPS) keys.push(`${prefix}${step.key}`);
    }
  }
  return keys;
}

// getAnatomyCoveredKeys 중 비강 소견 페이지(SeptumDiagram)가 담당하는 키만
export function getSeptumCoveredKeys(surgeryTypeCode: string): string[] {
  return getAnatomyVisibility(surgeryTypeCode).showSeptum ? ["n_dev_side"] : [];
}

// getAnatomyCoveredKeys 중 수술 방법 페이지(SinusDiagram)가 담당하는 키만
export function getSinusCoveredKeys(surgeryTypeCode: string): string[] {
  return getAnatomyCoveredKeys(surgeryTypeCode).filter((k) => k !== "n_dev_side");
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
    // 실제 제출용 select 값을 먼저 동기적으로 맞춰둔 다음 onChange를 불러야
    // (라이브 미리보기가) 지금 클릭한 값을 바로 읽어갈 수 있다. 예전에
    // requestAnimationFrame으로 다음 페인트 이후에 미뤘더니, onChange가
    // 그보다 먼저 실행되어 미리보기가 한 클릭씩 뒤처지는 문제가 있었다.
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
        <br />
        영상의학 기준: 왼쪽 = 환자 우측(Rt.), 오른쪽 = 환자 좌측(Lt.)
      </p>
      <svg viewBox="0 0 220 80" className="w-full max-w-xs">
        {zone("우측", "우측", 5)}
        <rect x={80} y={10} width={60} height={60} rx={8} fill="#e2e8f0" stroke="#94a3b8" />
        <text x={110} y={40} textAnchor="middle" fontSize="10" fill="#64748b">
          비중격
        </text>
        <text x={110} y={54} textAnchor="middle" fontSize="9" fill="#94a3b8">
          (Septum)
        </text>
        {zone("좌측", "좌측", 145)}
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
  hideRevisionToggle,
}: {
  values?: FieldValues;
  onChange?: () => void;
  // 계획 작성 화면(SurgeryPlanner)에서는 Revision case 체크박스를 탭과
  // 무관하게 항상 보이는 곳에 따로 두므로, 여기서는 중복으로 보이지
  // 않게 숨긴다 — revision 상태 자체(Uncinectomy 행 노출 여부)는 그대로 쓴다.
  hideRevisionToggle?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState<boolean>(() => values?.f_revision === true);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const prefix of ["f_left_", "f_right_"] as const) {
      next[`${prefix}uncinectomy`] = values?.[`${prefix}uncinectomy`] === true;
      for (const step of SINUS_STEPS) {
        next[`${prefix}${step.key}`] = values?.[`${prefix}${step.key}`] === true;
      }
    }
    return next;
  });

  function toggle(prefix: "f_left_" | "f_right_", key: string) {
    const fullKey = `${prefix}${key}`;
    // DOM의 실제 checkbox 값을 기준으로 다음 값을 정하고 동기적으로 바로
    // 반영한 다음 onChange를 부른다 — rAF로 다음 페인트까지 미루면 onChange
    // (라이브 미리보기 갱신)가 그보다 먼저 실행되어 방금 누른 값이 아직
    // 반영 안 된 상태로 읽혀서, 연달아 누를 때 한 클릭씩 뒤처지는 문제가 있었다.
    const form = findForm(rootRef.current);
    const el = getInput(form, `field_${fullKey}`);
    const nextVal = el instanceof HTMLInputElement ? !el.checked : !checked[fullKey];
    if (el instanceof HTMLInputElement) el.checked = nextVal;
    setChecked((c) => ({ ...c, [fullKey]: nextVal }));
    onChange?.();
  }

  // Revision case(재수술)에서는 uncinectomy가 이전 수술 때 이미 됐을 수 있어서
  // 자동으로 넣지 않고 직접 체크하게 한다 — 처음 켤 때는 보통 다시 확인/완료가
  // 필요한 경우가 많아 기본으로 체크해서 맨 위에 보여준다.
  function toggleRevision() {
    const form = findForm(rootRef.current);
    const el = getInput(form, "field_f_revision");
    const nextVal = el instanceof HTMLInputElement ? !el.checked : !revision;
    if (el instanceof HTMLInputElement) el.checked = nextVal;
    setRevision(nextVal);
    if (nextVal) {
      for (const key of ["f_right_uncinectomy", "f_left_uncinectomy"]) {
        const uEl = getInput(form, `field_${key}`);
        if (uEl instanceof HTMLInputElement) uEl.checked = true;
      }
      setChecked((c) => ({ ...c, f_right_uncinectomy: true, f_left_uncinectomy: true }));
    }
    onChange?.();
  }

  // 좌우가 대칭인 경우가 많아, 한쪽만 눌러두고 반대쪽에 그대로 복사할 수
  // 있게 한다 — 매번 양쪽을 각각 누르지 않아도 되게.
  function copyToOtherSide(from: "f_left_" | "f_right_") {
    const to = from === "f_left_" ? "f_right_" : "f_left_";
    const form = findForm(rootRef.current);
    setChecked((c) => {
      const next = { ...c };
      for (const key of Object.keys(c)) {
        if (!key.startsWith(from)) continue;
        const suffix = key.slice(from.length);
        const val = c[key];
        const toKey = `${to}${suffix}`;
        next[toKey] = val;
        const el = getInput(form, `field_${toKey}`);
        if (el instanceof HTMLInputElement) el.checked = val;
      }
      return next;
    });
    onChange?.();
  }

  const column = (prefix: "f_left_" | "f_right_", label: string) => (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex flex-col gap-2">
        {revision && (
          <button
            type="button"
            onClick={() => toggle(prefix, "uncinectomy")}
            className={`min-h-[44px] w-28 touch-manipulation rounded-md border px-3 py-2.5 text-xs leading-tight select-none active:scale-95 ${
              checked[`${prefix}uncinectomy`]
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Uncinectomy
          </button>
        )}
        {SINUS_STEPS.map((s) => {
          const active = checked[`${prefix}${s.key}`];
          return (
            <button
              type="button"
              key={s.key}
              onClick={() => toggle(prefix, s.key)}
              className={`min-h-[44px] w-28 touch-manipulation rounded-md border px-3 py-2.5 text-xs leading-tight select-none active:scale-95 ${
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
        <br />
        영상의학 기준: 왼쪽 = 환자 우측(Rt.), 오른쪽 = 환자 좌측(Lt.)
      </p>
      {!hideRevisionToggle && (
        <label className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={revision}
            onChange={toggleRevision}
            className="h-4 w-4 rounded border-slate-300"
          />
          Revision case (재수술)
        </label>
      )}
      <div className="mb-2 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => copyToOtherSide("f_right_")}
          className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          우→좌 동일
        </button>
        <button
          type="button"
          onClick={() => copyToOtherSide("f_left_")}
          className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          좌→우 동일
        </button>
      </div>
      <div className="flex items-start justify-center gap-8">
        {column("f_right_", "우측 (Rt.)")}
        {column("f_left_", "좌측 (Lt.)")}
      </div>
    </div>
  );
}
