"use client";

import { useState, type ReactNode } from "react";
import type { FieldValues } from "@/lib/field-types";

// 비강 소견을 "Septoturbinoplasty P/E" / "ESS P/E"처럼 큰 덩어리로 접어두고,
// 실제로 그 진찰/소견을 기록할 때만 체크해서 펼치는 섹션. 체크 여부 자체가
// 하나의 폼 필드(field_{doneKey})로 제출되어, 기록지 자동 생성 시에도 이
// 값을 기준으로 해당 그룹 내용을 포함할지 결정한다.
export function CollapsibleFindingSection({
  doneKey,
  label,
  values,
  children,
  onChange,
}: {
  doneKey: string;
  label: string;
  values?: FieldValues;
  children: ReactNode;
  onChange?: () => void;
}) {
  const [done, setDone] = useState<boolean>(values?.[doneKey] === true);

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name={`field_${doneKey}`}
          checked={done}
          onChange={(e) => {
            setDone(e.target.checked);
            onChange?.();
          }}
          className="h-4 w-4 rounded border-slate-300"
        />
        {label}
      </label>
      {done && <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">{children}</div>}
    </div>
  );
}
