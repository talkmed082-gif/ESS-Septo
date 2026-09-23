"use client";

import { useRef, useState } from "react";
import type { FieldValues } from "@/lib/field-types";
import { buttonStyles } from "@/lib/ui";

const TURB_TYPES = [
  { key: "middle", label: "Middle turbinoplasty" },
  { key: "inferior", label: "Inferior turbinoplasty" },
] as const;

const SIDES = [
  { prefix: "right", label: "우측 (Rt.)" },
  { prefix: "left", label: "좌측 (Lt.)" },
] as const;

// 모식도/픽커와 마찬가지로 이 컴포넌트가 대신 입력을 담당하는 필드 —
// SurgeryFieldInputs 목록에서는 제외하고 여기서만 선택하게 한다.
export const TURBINOPLASTY_FIELD_KEYS = SIDES.flatMap((side) =>
  TURB_TYPES.map((t) => `turb_${t.key}_${side.prefix}`),
);

function findForm(el: HTMLElement | null): HTMLFormElement | null {
  return el?.closest("form") ?? null;
}

function getInput(form: HTMLFormElement | null, name: string) {
  if (!form) return null;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement ? el : null;
}

export function TurbinoplastyTypePicker({
  values,
  onChange,
}: {
  values?: FieldValues;
  onChange?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const key of TURBINOPLASTY_FIELD_KEYS) next[key] = values?.[key] === true;
    return next;
  });
  // 시행 여부부터 체크 → 체크해야 어떤 turbinate인지 고르는 4칸이 열리는
  // 2단계 구조. 기존 값 중 하나라도 체크돼 있으면 이미 시행한 것이므로
  // 처음부터 열어서 보여준다.
  const [performed, setPerformed] = useState(() => Object.values(checked).some(Boolean));

  function togglePerformed() {
    const next = !performed;
    setPerformed(next);
    if (!next) {
      // 시행 안 함으로 되돌리면 감춰지는 세부 선택도 실제로 다 꺼서, 화면에
      // 안 보이는 체크가 폼에 남아 있지 않게 한다.
      const form = findForm(rootRef.current);
      setChecked((c) => {
        const cleared: Record<string, boolean> = {};
        for (const key of Object.keys(c)) {
          cleared[key] = false;
          const el = getInput(form, `field_${key}`);
          if (el) el.checked = false;
        }
        return cleared;
      });
    }
    onChange?.();
  }

  function toggle(key: string) {
    const form = findForm(rootRef.current);
    const el = getInput(form, `field_${key}`);
    const nextVal = el ? !el.checked : !checked[key];
    if (el) el.checked = nextVal;
    setChecked((c) => ({ ...c, [key]: nextVal }));
    onChange?.();
  }

  // 좌우 축소술 시행 부위가 같은 경우가 많아, 한쪽만 선택하고 반대쪽에
  // 그대로 복사할 수 있게 한다.
  function copyToOtherSide(fromSide: "right" | "left") {
    const toSide = fromSide === "right" ? "left" : "right";
    const form = findForm(rootRef.current);
    setChecked((c) => {
      const next = { ...c };
      for (const t of TURB_TYPES) {
        const fromKey = `turb_${t.key}_${fromSide}`;
        const toKey = `turb_${t.key}_${toSide}`;
        const val = c[fromKey];
        next[toKey] = val;
        const el = getInput(form, `field_${toKey}`);
        if (el) el.checked = val;
      }
      return next;
    });
    onChange?.();
  }

  return (
    <div ref={rootRef} className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={performed}
            onChange={togglePerformed}
            className="h-4 w-4 rounded border-slate-300"
          />
          터비노플라스티 시행
        </label>
        {performed && (
          <div className="flex gap-1">
            <button type="button" onClick={() => copyToOtherSide("right")} className={buttonStyles.pill}>
              우→좌 동일
            </button>
            <button type="button" onClick={() => copyToOtherSide("left")} className={buttonStyles.pill}>
              좌→우 동일
            </button>
          </div>
        )}
      </div>
      {performed && (
        <div className="mt-2 flex gap-8">
          {SIDES.map((side) => (
            <div key={side.prefix} className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-500">{side.label}</span>
              {TURB_TYPES.map((t) => {
                const key = `turb_${t.key}_${side.prefix}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className={`min-h-[36px] touch-manipulation rounded-md border px-3 py-1.5 text-xs leading-tight active:scale-95 ${
                      checked[key]
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
