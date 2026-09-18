"use client";

import { useActionState } from "react";
import { updateOpPlan, type OpPlanFormState } from "@/app/actions/op-plans";
import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
import { OpNoteGenerateButton } from "@/components/op-note-generate-button";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";

export function PlanEditForm({
  planId,
  surgeryTypeCode,
  fields,
  values,
  defaultValues,
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
}) {
  const action = updateOpPlan.bind(null, planId);
  const [state, formAction, pending] = useActionState<
    OpPlanFormState | undefined,
    FormData
  >(action, undefined);

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

      <SurgeryFieldInputs fields={fields} values={values} />

      <OpNoteGenerateButton fields={fields} surgeryTypeCode={surgeryTypeCode} mode="plan" />

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
