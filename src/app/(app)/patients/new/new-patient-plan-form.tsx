"use client";

import { useActionState, useState } from "react";
import {
  createPatientWithPlan,
  type PatientPlanFormState,
} from "@/app/actions/patient-plan";
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
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";
import type { NameStyle } from "@/lib/op-note-generator";
import { isNasalFindingKey } from "@/lib/op-note-defs";
import type { RecentCombo } from "@/lib/recent-combos";

export interface SurgeryTypeOption {
  id: string;
  code: string;
  name: string;
  fields: SurgeryFieldDef[];
}

export function NewPatientPlanForm({
  surgeryTypes,
  nameStyle,
  recentCombosByType,
}: {
  surgeryTypes: SurgeryTypeOption[];
  nameStyle?: NameStyle;
  recentCombosByType?: Record<string, RecentCombo[]>;
}) {
  const [state, formAction, pending] = useActionState<
    PatientPlanFormState | undefined,
    FormData
  >(createPatientWithPlan, undefined);
  const [surgeryTypeId, setSurgeryTypeId] = useState("");
  const [templateValues, setTemplateValues] = useState<FieldValues | undefined>(undefined);
  const [templateKey, setTemplateKey] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);

  const selected = surgeryTypes.find((st) => st.id === surgeryTypeId);
  const recentCombos = surgeryTypeId ? recentCombosByType?.[surgeryTypeId] ?? [] : [];
  const nasalFields = selected ? selected.fields.filter((f) => isNasalFindingKey(f.key)) : [];
  const procedureFields = selected ? selected.fields.filter((f) => !isNasalFindingKey(f.key)) : [];
  const { showSeptum, showSinus } = selected
    ? getAnatomyVisibility(selected.code)
    : { showSeptum: false, showSinus: false };
  const stepButtonClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium ${
      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  function applyCombo(values: FieldValues) {
    setTemplateValues(values);
    setTemplateKey((k) => k + 1);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            환자 이름 *
          </label>
          <input
            name="name"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {state?.errors?.name && (
            <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            차트번호
          </label>
          <input
            name="chartNo"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            성별
          </label>
          <select
            name="sex"
            defaultValue=""
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">선택 안 함</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            생년월일
          </label>
          <input
            type="date"
            name="birthDate"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          메모
        </label>
        <textarea
          name="memo"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <hr className="border-slate-200" />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          수술 계획 — 수술 종류
        </label>
        <select
          name="surgeryTypeId"
          value={surgeryTypeId}
          onChange={(e) => {
            setSurgeryTypeId(e.target.value);
            setTemplateValues(undefined);
            setTemplateKey((k) => k + 1);
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">계획은 나중에 작성 (환자만 등록)</option>
          {surgeryTypes.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div key={`${selected.id}-${templateKey}`} className="space-y-4 rounded-md border border-slate-200 p-4">
          {recentCombos.length > 0 && (
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                수술 예정일
              </label>
              <input
                type="date"
                name="plannedDate"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                수술측
              </label>
              <select
                name="side"
                defaultValue=""
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 border-b border-slate-200 pb-3">
            <button type="button" onClick={() => setStep(1)} className={stepButtonClass(step === 1)}>
              1. 비강/영상 소견
            </button>
            <button type="button" onClick={() => setStep(2)} className={stepButtonClass(step === 2)}>
              2. 수술 방법
            </button>
          </div>

          <div className={step === 1 ? "space-y-4" : "hidden"}>
            {showSeptum && <SeptumDiagram values={templateValues} />}
            <PolypPicker values={templateValues} />
            <SurgeryFieldInputs
              fields={nasalFields}
              values={templateValues}
              excludeKeys={[...getSeptumCoveredKeys(selected.code), ...POLYP_FIELD_KEYS]}
            />
          </div>
          <div className={step === 2 ? "space-y-4" : "hidden"}>
            {showSinus && <SinusDiagram values={templateValues} />}
            <SurgeryFieldInputs
              fields={procedureFields}
              values={templateValues}
              excludeKeys={getSinusCoveredKeys(selected.code)}
            />
          </div>
          <OpNoteGenerateButton
            fields={selected.fields}
            surgeryTypeCode={selected.code}
            mode="plan"
            nameStyle={nameStyle}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              계획 메모
            </label>
            <textarea
              name="planNote"
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "저장 중..." : selected ? "환자 등록 + 계획 저장" : "환자 등록"}
      </button>
    </form>
  );
}
