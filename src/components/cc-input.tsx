"use client";

import { useState } from "react";
import { CC_SIDES, CC_SYMPTOMS, ccSymptomSide, toggleCcSymptom, type CcSide } from "@/lib/remark";

// CC(주호소) 입력 — 자주 쓰는 증상은 버튼으로 넣고, 방향이 있는 증상(코막힘 등)은
// 먼저 고른 방향(Rt./Lt./Both)을 붙여 넣는다. 그 밖의 내용은 칸에 직접 적는다.
// 폼 전체 onChange(기록지 초안 재계산)로 퍼지지 않게 이벤트를 여기서 막는다 —
// CC는 초안 내용과 상관이 없어서 글자마다 초안을 다시 만들 이유가 없다.
export function CcInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [side, setSide] = useState<CcSide | "">("");
  const chipClass = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs font-medium ${
      active
        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
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
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">방향</span>
        {(["", ...CC_SIDES] as const).map((s) => (
          <button key={s || "none"} type="button" onClick={() => setSide(s)} className={chipClass(side === s)}>
            {s || "없음"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CC_SYMPTOMS.map((symptom) => {
          const current = ccSymptomSide(value, symptom.label);
          return (
            <button
              key={symptom.label}
              type="button"
              onClick={() => onChange(toggleCcSymptom(value, symptom.label, symptom.side ? side || undefined : undefined))}
              className={chipClass(current !== undefined)}
            >
              {symptom.label}
              {current ? ` ${current}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
