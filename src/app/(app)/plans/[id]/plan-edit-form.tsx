"use client";

import { useActionState, useRef, useState } from "react";
import { updateOpPlan, type OpPlanFormState } from "@/app/actions/op-plans";
import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
import { OpNoteGenerateButton } from "@/components/op-note-generate-button";
import {
  SeptumDiagram,
  SinusDiagram,
  getAnatomyVisibility,
  getSeptumCoveredKeys,
  getSinusCoveredKeys,
} from "@/components/anatomy-diagram";
import { PolypPicker, POLYP_FIELD_KEYS } from "@/components/polyp-picker";
import { EssFindingsPicker, ESS_FINDINGS_FIELD_KEYS } from "@/components/ess-findings-picker";
import { PresetBar, type PresetItem } from "@/components/preset-bar";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";
import type { NameStyle } from "@/lib/op-note-generator";
import { isNasalFindingKey, SEPTUM_DETAIL_FIELD_KEYS, UNCINATE_FIELD_KEYS } from "@/lib/op-note-defs";
import type { RecentCombo } from "@/lib/recent-combos";

export function PlanEditForm({
  planId,
  surgeryTypeId,
  surgeryTypeCode,
  fields,
  values,
  defaultValues,
  nameStyle,
  recentCombos,
  presets,
}: {
  planId: string;
  surgeryTypeId: string;
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
  presets?: PresetItem[];
}) {
  const action = updateOpPlan.bind(null, planId);
  const [state, formAction, pending] = useActionState<
    OpPlanFormState | undefined,
    FormData
  >(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [templateValues, setTemplateValues] = useState<FieldValues | undefined>(undefined);
  const [templateKey, setTemplateKey] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);
  const activeValues = templateValues ?? values;

  const { showSeptum, showSinus } = getAnatomyVisibility(surgeryTypeCode);
  const nasalFields = fields.filter((f) => isNasalFindingKey(f.key));
  const procedureFields = fields.filter((f) => !isNasalFindingKey(f.key));
  const stepButtonClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium ${
      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  function applyCombo(v: FieldValues) {
    setTemplateValues(v);
    setTemplateKey((k) => k + 1);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
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

      <PresetBar
        surgeryTypeId={surgeryTypeId}
        fields={fields}
        initialPresets={presets ?? []}
        formRef={formRef}
        onApply={applyCombo}
      />

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

      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <button type="button" onClick={() => setStep(1)} className={stepButtonClass(step === 1)}>
          1. 비강/영상 소견
        </button>
        <button type="button" onClick={() => setStep(2)} className={stepButtonClass(step === 2)}>
          2. 수술 방법
        </button>
      </div>

      <div key={templateKey}>
        <div className={step === 1 ? "space-y-4" : "hidden"}>
          {showSeptum && (
            <>
              <SeptumDiagram values={activeValues} />
              <SurgeryFieldInputs
                fields={nasalFields.filter((f) => SEPTUM_DETAIL_FIELD_KEYS.includes(f.key))}
                values={activeValues}
              />
            </>
          )}
          {showSinus && (
            <>
              <SurgeryFieldInputs
                fields={nasalFields.filter((f) => UNCINATE_FIELD_KEYS.includes(f.key))}
                values={activeValues}
              />
              <EssFindingsPicker values={activeValues} />
              <PolypPicker values={activeValues} />
            </>
          )}
          <SurgeryFieldInputs
            fields={nasalFields}
            values={activeValues}
            excludeKeys={[
              ...getSeptumCoveredKeys(surgeryTypeCode),
              ...SEPTUM_DETAIL_FIELD_KEYS,
              ...UNCINATE_FIELD_KEYS,
              ...POLYP_FIELD_KEYS,
              ...ESS_FINDINGS_FIELD_KEYS,
            ]}
          />
        </div>
        <div className={step === 2 ? "space-y-4" : "hidden"}>
          {showSinus && <SinusDiagram values={activeValues} />}
          <SurgeryFieldInputs
            fields={procedureFields}
            values={activeValues}
            excludeKeys={getSinusCoveredKeys(surgeryTypeCode)}
          />
        </div>
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
