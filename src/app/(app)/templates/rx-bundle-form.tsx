"use client";

import { useActionState } from "react";
import type { RxFormState } from "@/app/actions/rx-bundles";
import type { RxItem } from "@/lib/rx-bundles";
import { buttonStyles } from "@/lib/ui";

const inputClass = "rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none";

function ruleText(i: RxItem) {
  const r = i.ped;
  const min = i.minMonths != null ? `${i.minMonths}개월 이상 · ` : "";
  if (!r) return `${i.dose || "기본"} ${i.freq || ""} ${i.days ? `${i.days}일` : ""}`.trim();
  if (r.type === "fixed") return `${min}EMR 기본 용법`;
  if (r.type === "kg") return `${min}${r.mgPerKgDay}mg/kg/일 ÷ ${r.timesPerDay}회 (${r.freq})${r.maxMgDay ? ` · 최대 ${r.maxMgDay}mg/일` : ""}${r.maxKg ? ` · ${r.maxKg}kg 미만` : ""} · ${i.days}일`;
  const bands = r.type === "age"
    ? r.bands.map((b) => `${b.fromMonths}~${b.toMonths ?? ""}개월 ${b.dose} ${b.freq}`)
    : r.bands.map((b) => `${b.fromKg}~${b.toKg ?? ""}kg ${b.dose} ${b.freq}`);
  return `${min}${bands.join(" / ")} · ${i.days}일`;
}

// 처방 묶음 한 개 — 위는 읽기 쉬운 목록, 아래 JSON 칸에서 고친다(소아 계산 규칙 포함)
export function RxBundleForm({
  bundle,
  action,
  deleteAction,
}: {
  bundle: { title: string; audience: string; sortOrder: number; items: RxItem[] };
  action: (s: RxFormState, f: FormData) => Promise<RxFormState>;
  deleteAction: () => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2 text-sm">
      <ul className="space-y-1">
        {bundle.items.map((i, k) => (
          <li key={k} className="flex flex-wrap gap-x-2">
            <span className="font-medium text-slate-800">{i.name}</span>
            <span className="text-slate-400">{i.code}</span>
            <span className="text-slate-600">{ruleText(i)}</span>
            {i.note && <span className="text-amber-700">{i.note}</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input name="title" required maxLength={60} defaultValue={bundle.title} aria-label="묶음 이름" className={`${inputClass} flex-1`} />
        <input type="hidden" name="audience" value={bundle.audience} />
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={bundle.sortOrder} aria-label="순서" className={`${inputClass} w-20`} />
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-slate-500">약 목록 고치기(JSON)</summary>
        <textarea name="items" rows={10} defaultValue={JSON.stringify(bundle.items, null, 1)} aria-label="약 목록" className={`${inputClass} w-full font-mono text-xs`} />
      </details>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={buttonStyles.primarySmall}>
          저장
        </button>
        <button type="submit" formAction={deleteAction} className={buttonStyles.danger}>
          삭제
        </button>
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-xs text-emerald-700">저장됨</span>}
      </div>
    </form>
  );
}
