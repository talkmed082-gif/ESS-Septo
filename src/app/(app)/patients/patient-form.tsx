"use client";

import { useActionState } from "react";
import type { PatientFormState } from "@/app/actions/patients";
import { buttonStyles } from "@/lib/ui";

type Action = (
  state: PatientFormState | undefined,
  formData: FormData,
) => Promise<PatientFormState>;

export function PatientForm({
  action,
  defaultValues,
  submitLabel,
  returnTo,
}: {
  action: Action;
  defaultValues?: {
    name?: string;
    chartNo?: string;
    sex?: string;
    age?: string;
    memo?: string;
  };
  submitLabel: string;
  // 저장 후 어디로 돌아갈지 — 환자 목록에서 왔으면 목록으로, 환자 상세
  // 화면에서 왔으면 그 화면으로 돌아가게 한다. 안 넘기면 액션이 기본값을 씀.
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            이름 *
          </label>
          <input
            name="name"
            defaultValue={defaultValues?.name}
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
            defaultValue={defaultValues?.chartNo}
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
            defaultValue={defaultValues?.sex ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">선택 안 함</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            나이
          </label>
          <input
            type="number"
            name="age"
            min="0"
            defaultValue={defaultValues?.age}
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
          defaultValue={defaultValues?.memo}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className={buttonStyles.primary}
      >
        {pending ? "저장 중..." : submitLabel}
      </button>
    </form>
  );
}
