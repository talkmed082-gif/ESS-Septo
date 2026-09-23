"use client";

import { useRef, useState } from "react";
import type { FieldValues } from "@/lib/field-types";
import { buttonStyles } from "@/lib/ui";

const POLYP_SITE_FIELDS = [
  { key: "site_mm", label: "중비도" },
  { key: "site_ethmoid", label: "사골동" },
  { key: "site_maxillary", label: "상악동 자연공" },
  { key: "site_sphenoid", label: "접형동" },
  { key: "site_choana", label: "후비공까지 연장" },
] as const;

const SIDES = [
  { prefix: "n_polyp_right_", label: "우측 (Rt.)" },
  { prefix: "n_polyp_left_", label: "좌측 (Lt.)" },
] as const;

// 모식도(AnatomyPicker)와 마찬가지로 이 컴포넌트가 대신 입력을 담당하는 필드 —
// SurgeryFieldInputs 목록에서는 제외하고 여기서만 선택하게 한다.
export const POLYP_FIELD_KEYS = SIDES.flatMap((side) =>
  POLYP_SITE_FIELDS.map((f) => `${side.prefix}${f.key}`),
);

function findForm(el: HTMLElement | null): HTMLFormElement | null {
  return el?.closest("form") ?? null;
}

function getInput(form: HTMLFormElement | null, name: string) {
  if (!form) return null;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement ? el : null;
}

// 비용종이 없는 경우가 더 많아, "있음" 체크부터 하고 체크했을 때만 좌/우
// 위치 선택 UI가 나타나게 한다 (ESS 이상소견과 같은 체크 → 상세 패턴).
// 좌/우 정도(위치)가 서로 다른 경우가 많아 공통 "방향" 선택 없이 측별로
// 위치를 각각 고르게 한다 — 위치가 하나라도 체크된 측에 비용종이 있는 것으로 본다.
export function PolypPicker({
  values,
  onChange,
  hideToggle = false,
}: {
  values?: FieldValues;
  onChange?: () => void;
  // true면 자체 "비용종 있음" 체크박스를 감추고 항상 상세 선택 칸만 보여준다 —
  // 상위(NasalFindingsOverview)가 그룹 전체를 이미 보여줄지 말지 결정하는
  // 화면에서, 체크박스가 중복으로 두 번 보이지 않게 하기 위함.
  hideToggle?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [sites, setSites] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const side of SIDES) {
      for (const f of POLYP_SITE_FIELDS) next[`${side.prefix}${f.key}`] = values?.[`${side.prefix}${f.key}`] === true;
    }
    return next;
  });
  const [present, setPresent] = useState<boolean>(() => Object.values(sites).some(Boolean));

  function clearAllSites() {
    const form = findForm(rootRef.current);
    setSites((s) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(s)) {
        next[key] = false;
        const el = getInput(form, `field_${key}`);
        if (el) el.checked = false;
      }
      return next;
    });
  }

  function togglePresent() {
    setPresent((p) => {
      const next = !p;
      if (!next) clearAllSites();
      return next;
    });
    onChange?.();
  }

  // DOM의 실제 checkbox 값을 기준으로 다음 값을 정하고 동기적으로 바로
  // 반영한 다음 onChange를 부른다 — 다음 페인트까지 미루면 onChange(라이브
  // 미리보기 갱신)가 그보다 먼저 실행되어 방금 누른 값이 반영 안 된 채로
  // 읽히는 문제가 있었다.
  function toggleSite(fullKey: string) {
    const form = findForm(rootRef.current);
    const el = getInput(form, `field_${fullKey}`);
    const nextVal = el ? !el.checked : !sites[fullKey];
    if (el) el.checked = nextVal;
    setSites((s) => ({ ...s, [fullKey]: nextVal }));
    onChange?.();
  }

  // 좌우 위치가 같은 경우가 많아, 한쪽 체크한 걸 반대쪽에 그대로 복사할 수 있게 한다.
  function copyToOtherSide(fromPrefix: (typeof SIDES)[number]["prefix"]) {
    const toPrefix = SIDES.find((s) => s.prefix !== fromPrefix)!.prefix;
    const form = findForm(rootRef.current);
    setSites((s) => {
      const next = { ...s };
      for (const f of POLYP_SITE_FIELDS) {
        const val = s[`${fromPrefix}${f.key}`];
        const toKey = `${toPrefix}${f.key}`;
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
      {!hideToggle && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={present}
            onChange={togglePresent}
            className="h-4 w-4 rounded border-slate-300"
          />
          비용종(Polyp) 있음
        </label>
      )}
      {(hideToggle || present) && (
        <div className={hideToggle ? undefined : "mt-3 border-t border-slate-100 pt-3"}>
          <div className="mb-2 flex gap-2">
            <button type="button" onClick={() => copyToOtherSide("n_polyp_right_")} className={buttonStyles.pill}>
              우→좌 동일
            </button>
            <button type="button" onClick={() => copyToOtherSide("n_polyp_left_")} className={buttonStyles.pill}>
              좌→우 동일
            </button>
          </div>
          <div className="flex flex-wrap gap-6">
          {SIDES.map((side) => (
            <div key={side.prefix} className="flex flex-col items-start gap-2">
              <span className="text-xs font-medium text-slate-600">{side.label}</span>
              <div className="flex flex-wrap gap-2">
                {POLYP_SITE_FIELDS.map((f) => {
                  const fullKey = `${side.prefix}${f.key}`;
                  return (
                    <button
                      key={fullKey}
                      type="button"
                      onClick={() => toggleSite(fullKey)}
                      className={`min-h-[36px] touch-manipulation rounded-md border px-3 py-1.5 text-xs active:scale-95 ${
                        sites[fullKey]
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
