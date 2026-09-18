"use client";

import { useActionState, useState } from "react";
import { updateOpPlan, type OpPlanFormState } from "@/app/actions/op-plans";
import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
import { OpNoteGenerateButton } from "@/components/op-note-generate-button";
import { AnatomyPicker, getAnatomyCoveredKeys } from "@/components/anatomy-diagram";
import { PolypPicker, POLYP_FIELD_KEYS } from "@/components/polyp-picker";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";
import type { NameStyle } from "@/lib/op-note-generator";
import type { RecentCombo } from "@/lib/recent-combos";

export function PlanEditForm({
  planId,
  surgeryTypeCode,
  fields,
  values,
  defaultValues,
  nameStyle,
  recentCombos,
}: {
  planId: string;
  surgeryTypeCode: string;
  fields: SurgeryFieldDef[];
  values: FieldValues;
  defaultValues: {
    plannedDate: string;
    side: string;
    diagnosis: string;
    planNote: string;
  };
  nameStyle?: NameStyle;
  recentCombos?: RecentCombo[];
}) {
  const action = updateOpPlan.bind(null, planId);
  const [state, formAction, pending] = useActionState<
    OpPlanFormState | undefined,
    FormData
  >(action, undefined);
  const [templateValues, setTemplateValues] = useState<FieldValues | undefined>(undefined);
  const [templateKey, setTemplateKey] = useState(0);
  const activeValues = templateValues ?? values;

  function applyCombo(v: FieldValues) {
    setTemplateValues(v);
    setTemplateKey((k) => k + 1);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            수술 예정일
          </label>
          <input
            type="date"
            name="plannedDate"
            defaultValue={defaultValues.plannedDate}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            수술측
          </label>
          <select
            name="side"
            defaultValue={defaultValues.side}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">선택 안 함</option>
            <option value="Rt.">우측 (Rt.)</option>
            <option value="Lt.">좌측 (Lt.)</option>
            <option value="Both">양측 (Both)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          술전 진단명
        </label>
        <input
          name="diagnosis"
          defaultValue={defaultValues.diagnosis}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {recentCombos && recentCombos.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">최근 사용한 조합</p>
          <div className="flex flex-wrap gap-2">
            {recentCombos.map((combo, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyCombo(combo.values)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
              >
                {combo.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div key={templateKey} className="space-y-4">
        <AnatomyPicker surgeryTypeCode={surgeryTypeCode} values={activeValues} />
        <PolypPicker values={activeValues} />
        <SurgeryFieldInputs
          fields={fields}
          values={activeValues}
          excludeKeys={[...getAnatomyCoveredKeys(surgeryTypeCode), ...POLYP_FIELD_KEYS]}
        />
      </div>

      <OpNoteGenerateButton
        fields={fields}
        surgeryTypeCode={surgeryTypeCode}
        mode="plan"
        nameStyle={nameStyle}
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          계획 메모
        </label>
        <textarea
          name="planNote"
          defaultValue={defaultValues.planNote}
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "계획 저장"}
      </button>
    </form>
  );
}
