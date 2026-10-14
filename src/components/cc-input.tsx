"use client";

import { CC_SIDES, CC_SYMPTOMS, ccSymptomSide, removeCcSymptom, setCcSymptomSide } from "@/lib/remark";

// CC(주호소) 입력 — 증상 버튼을 누르면 들어가고 다시 누르면 빠진다. 방향이 있는 증상(코막힘 등)은
// 들어가 있는 동안 바로 옆에 Rt./Lt./Both가 나와 그 자리에서 고른다(같은 방향을 다시 누르면 방향만
// 지움). 예전엔 방향을 먼저 골라 두고 증상을 눌러야 해서 순서가 어색했다(사용자 지적 2026-10-14).
// 폼 전체 onChange(기록지 초안 재계산)로 퍼지지 않게 이벤트를 여기서 막는다.
export function CcInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const chipClass = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs font-medium ${
      active
        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
    }`;
  const sideClass = (active: boolean) =>
    `rounded border px-1.5 py-0.5 text-[11px] ${
      active ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">CC (주호소)</label>
      <input
        name="chiefComplaint"
        value={value}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.value);
        }}
        placeholder="예: 코막힘 (Both), 후비루"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        {CC_SYMPTOMS.map((symptom) => {
          const current = ccSymptomSide(value, symptom.label);
          const active = current !== undefined;
          return (
            <span key={symptom.label} className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(active ? removeCcSymptom(value, symptom.label) : setCcSymptomSide(value, symptom.label))
                }
                className={chipClass(active)}
              >
                {symptom.label}
              </button>
              {active &&
                symptom.side &&
                CC_SIDES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`${symptom.label} ${s}`}
                    aria-pressed={current === s}
                    onClick={() => onChange(setCcSymptomSide(value, symptom.label, current === s ? undefined : s))}
                    className={sideClass(current === s)}
                  >
                    {s}
                  </button>
                ))}
            </span>
          );
        })}
      </div>
    </div>
  );
}
