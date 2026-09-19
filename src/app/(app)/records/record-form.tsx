"use client";

import { useActionState, useState } from "react";
import type { OpRecordFormState } from "@/app/actions/op-records";
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
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";
import type { NameStyle } from "@/lib/op-note-generator";
import { isNasalFindingKey } from "@/lib/op-note-defs";

type Action = (
  state: OpRecordFormState | undefined,
  formData: FormData,
) => Promise<OpRecordFormState>;

export interface RecordDefaultValues {
  operationDate: string;
  surgeonName: string;
  assistantName: string;
  anesthesiaType: string;
  preOpDiagnosis: string;
  postOpDiagnosis: string;
  procedureName: string;
  findings: string;
  procedureDetail: string;
  complication: string;
  estimatedBloodLoss: string;
  specimen: string;
  postOpPlan: string;
}

export function RecordForm({
  action,
  surgeryTypeCode,
  fields,
  fieldValues,
  defaultValues,
  submitLabel,
  nameStyle,
}: {
  action: Action;
  surgeryTypeCode: string;
  fields: SurgeryFieldDef[];
  fieldValues: FieldValues;
  defaultValues: RecordDefaultValues;
  submitLabel: string;
  nameStyle?: NameStyle;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState<1 | 2>(1);

  const { showSeptum, showSinus } = getAnatomyVisibility(surgeryTypeCode);
  const nasalFields = fields.filter((f) => isNasalFindingKey(f.key));
  const procedureFields = fields.filter((f) => !isNasalFindingKey(f.key));

  const stepButtonClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium ${
      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            수술일 *
          </label>
          <input
            type="date"
            name="operationDate"
            defaultValue={defaultValues.operationDate}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            마취 종류
          </label>
          <select
            name="anesthesiaType"
            defaultValue={defaultValues.anesthesiaType}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">선택 안 함</option>
            <option value="General">전신마취 (General)</option>
            <option value="Local">국소마취 (Local)</option>
            <option value="MAC">MAC</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            집도의 *
          </label>
          <input
            name="surgeonName"
            defaultValue={defaultValues.surgeonName}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            보조의
          </label>
          <input
            name="assistantName"
            defaultValue={defaultValues.assistantName}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            술전 진단명
          </label>
          <input
            name="preOpDiagnosis"
            defaultValue={defaultValues.preOpDiagnosis}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            술후 진단명
          </label>
          <input
            name="postOpDiagnosis"
            defaultValue={defaultValues.postOpDiagnosis}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          시행 수술명 (Procedure)
        </label>
        <input
          name="procedureName"
          defaultValue={defaultValues.procedureName}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={stepButtonClass(step === 1)}
        >
          1. 비강/영상 소견
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className={stepButtonClass(step === 2)}
        >
          2. 수술 방법
        </button>
      </div>

      <div className={step === 1 ? "space-y-4" : "hidden"}>
        <p className="text-sm font-medium text-slate-700">비강/영상 소견</p>
        {showSeptum && <SeptumDiagram values={fieldValues} />}
        {showSinus && (
          <>
            <EssFindingsPicker values={fieldValues} />
            <PolypPicker values={fieldValues} />
          </>
        )}
        <SurgeryFieldInputs
          fields={nasalFields}
          values={fieldValues}
          excludeKeys={[
            ...getSeptumCoveredKeys(surgeryTypeCode),
            ...POLYP_FIELD_KEYS,
            ...ESS_FINDINGS_FIELD_KEYS,
          ]}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            비강/영상 소견 (Findings)
          </label>
          <textarea
            name="findings"
            defaultValue={defaultValues.findings}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className={step === 2 ? "space-y-4" : "hidden"}>
        <p className="text-sm font-medium text-slate-700">수술 방법 / 시행 항목</p>
        {showSinus && <SinusDiagram values={fieldValues} />}
        <SurgeryFieldInputs
          fields={procedureFields}
          values={fieldValues}
          excludeKeys={getSinusCoveredKeys(surgeryTypeCode)}
        />

        <OpNoteGenerateButton
          fields={fields}
          surgeryTypeCode={surgeryTypeCode}
          mode="record"
          nameStyle={nameStyle}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            수술 과정 상세 (Operative procedure)
          </label>
          <textarea
            name="procedureDetail"
            defaultValue={defaultValues.procedureDetail}
            rows={6}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            합병증 (Complication)
          </label>
          <input
            name="complication"
            defaultValue={defaultValues.complication}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            추정 출혈량 (EBL)
          </label>
          <input
            name="estimatedBloodLoss"
            defaultValue={defaultValues.estimatedBloodLoss}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          검체 (Specimen)
        </label>
        <input
          name="specimen"
          defaultValue={defaultValues.specimen}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          술후 계획 (Post-op plan)
        </label>
        <textarea
          name="postOpPlan"
          defaultValue={defaultValues.postOpPlan}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "저장 중..." : submitLabel}
      </button>
    </form>
  );
}
