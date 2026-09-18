"use client";

import { useActionState } from "react";
import { createOpPlan, type OpPlanFormState } from "@/app/actions/op-plans";
import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
import { OpNoteGenerateButton } from "@/components/op-note-generate-button";
import type { SurgeryFieldDef } from "@/lib/field-types";

export function PlanForm({
  patientId,
  surgeryTypeId,
  surgeryTypeCode,
  surgeryTypeName,
  fields,
}: {
  patientId: string;
  surgeryTypeId: string;
  surgeryTypeCode: string;
  surgeryTypeName: string;
  fields: SurgeryFieldDef[];
}) {
  const action = createOpPlan.bind(null, patientId);
  const [state, formAction, pending] = useActionState<
    OpPlanFormState | undefined,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="surgeryTypeId" value={surgeryTypeId} />
      <p className="text-sm text-slate-500">
        수술 종류: <span className="font-medium text-slate-900">{surgeryTypeName}</span>
      </p>

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

      <SurgeryFieldInputs fields={fields} />

      <OpNoteGenerateButton fields={fields} surgeryTypeCode={surgeryTypeCode} mode="plan" />

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

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "수술 계획 저장"}
      </button>
    </form>
  );
}
