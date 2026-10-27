"use client";

import { useTransition } from "react";
import { setCarePlan } from "@/app/actions/clinic-plan";

const PLANS = [
  ["surgery", "수술"],
  ["cpap", "CPAP"],
  ["medication", "약물치료"],
  ["observation", "경과관찰"],
  ["return", "회송"],
] as const;

// 외래 진행 중 Plan(사용자 2026-10-27) — 수술·CPAP은 외래 후 화면에 모인다. 같은 걸 다시 누르면 지움
export function PlanPicker({ chartNo, current }: { chartNo: string; current: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1">
      {PLANS.map(([v, label]) => (
        <button
          key={v}
          type="button"
          disabled={pending}
          onClick={() => start(() => setCarePlan(chartNo, current === v ? null : v))}
          className={`rounded-md border px-3 py-1.5 text-sm ${current === v ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white hover:bg-slate-50"}`}
        >
          {label}
        </button>
      ))}
      {(current === "surgery" || current === "cpap") && <span className="self-center text-xs text-slate-500">→ 외래 후에서 정리</span>}
    </div>
  );
}
