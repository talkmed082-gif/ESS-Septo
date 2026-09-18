"use client";

import { useState, type RefObject } from "react";
import { createSurgeryPreset, deleteSurgeryPreset } from "@/app/actions/presets";
import { fieldValuesFromFormData, type FieldValues, type SurgeryFieldDef } from "@/lib/field-types";

export interface PresetItem {
  id: string;
  name: string;
  values: FieldValues;
}

// 미리 이름 붙여 저장해둔 필드 조합 — "최근 사용한 조합"과 달리 자동으로
// 사라지지 않고, 클릭 한 번으로 전체 항목을 불러와서 반복되는 수술의
// 계획/기록 작성 클릭 수를 크게 줄여준다.
export function PresetBar({
  surgeryTypeId,
  fields,
  initialPresets,
  formRef,
  onApply,
}: {
  surgeryTypeId: string;
  fields: SurgeryFieldDef[];
  initialPresets: PresetItem[];
  formRef: RefObject<HTMLFormElement | null>;
  onApply: (values: FieldValues) => void;
}) {
  const [presets, setPresets] = useState(initialPresets);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!formRef.current) return;
    const name = window.prompt("세트 이름을 입력하세요 (예: 기본 우측 ESS)");
    if (!name || !name.trim()) return;
    const values = fieldValuesFromFormData(new FormData(formRef.current), fields);
    setSaving(true);
    try {
      const preset = await createSurgeryPreset(surgeryTypeId, name.trim(), values);
      setPresets((p) => [preset, ...p]);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setPresets((p) => p.filter((preset) => preset.id !== id));
    await deleteSurgeryPreset(id);
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">저장된 세트</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full border border-slate-900 px-2.5 py-1 text-xs text-slate-900 hover:bg-slate-100 disabled:opacity-50"
        >
          + 현재 설정 저장
        </button>
      </div>
      {presets.length === 0 ? (
        <p className="text-xs text-slate-400">
          저장된 세트가 없습니다. 자주 쓰는 조합을 저장해두면 다음부터 클릭 한 번으로 불러올 수 있습니다.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <span
              key={preset.id}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 py-1 pr-1 pl-3 text-xs text-slate-700"
            >
              <button type="button" onClick={() => onApply(preset.values)} className="hover:underline">
                {preset.name}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(preset.id)}
                className="ml-1 rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label={`${preset.name} 삭제`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
