"use client";

import { useActionState } from "react";
import type { OpRecordFormState } from "@/app/actions/op-records";
import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
import { OpNoteGenerateButton } from "@/components/op-note-generate-button";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";

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
}: {
  action: Action;
  surgeryTypeCode: string;
  fields: SurgeryFieldDef[];
  fieldValues: FieldValues;
  defaultValues: RecordDefaultValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

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

      <p className="text-sm font-medium text-slate-700">수술 소견 / 시행 항목</p>
      <SurgeryFieldInputs fields={fields} values={fieldValues} />

      <OpNoteGenerateButton fields={fields} surgeryTypeCode={surgeryTypeCode} mode="record" />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          수술 소견 (Findings)
        </label>
        <textarea
          name="findings"
          defaultValue={defaultValues.findings}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

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
