"use client";

import { useState, useTransition } from "react";
import { toggleChecklistItem } from "@/app/actions/op-plans";

const CHECKLIST_ITEMS = [
  { key: "consent", label: "수술 동의서 확인" },
  { key: "npo", label: "마지막 금식(NPO) 시간 확인" },
  { key: "site_mark", label: "수술 부위/측 표시 확인" },
  { key: "antibiotics", label: "예방적 항생제 투여 확인" },
  { key: "iv_access", label: "정맥로 확보 확인" },
  { key: "anticoagulant", label: "항응고제/항혈소판제 중단 여부 확인" },
  { key: "timeout", label: "Timeout(수술 안전 체크리스트) 시행" },
] as const;

export function SurgeryChecklist({
  planId,
  checklist,
}: {
  planId: string;
  checklist: Record<string, boolean>;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(checklist);
  const [, startTransition] = useTransition();

  function toggle(key: string) {
    const next = !checked[key];
    setChecked((c) => ({ ...c, [key]: next }));
    startTransition(() => {
      toggleChecklistItem(planId, key, next);
    });
  }

  const doneCount = CHECKLIST_ITEMS.filter((item) => checked[item.key]).length;

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="mb-2 text-sm font-semibold text-slate-700">
        수술 당일 체크리스트{" "}
        <span className="font-normal text-slate-400">
          ({doneCount}/{CHECKLIST_ITEMS.length})
        </span>
      </p>
      <div className="space-y-1.5">
        {CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked[item.key] === true}
              onChange={() => toggle(item.key)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className={checked[item.key] ? "text-slate-400 line-through" : "text-slate-700"}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
