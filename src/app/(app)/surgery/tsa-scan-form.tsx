"use client";

import { useActionState } from "react";
import type { TsaScanFormState } from "@/app/actions/hospital-link";
import { buttonStyles } from "@/lib/ui";

const inputClass = "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function TsaScanForm({
  action,
  defaultFrom,
  tomorrow,
}: {
  action: (state: TsaScanFormState | undefined, formData: FormData) => Promise<TsaScanFormState>;
  defaultFrom: string;
  tomorrow: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input name="from" type="date" required defaultValue={defaultFrom} max={tomorrow} aria-label="시작 날짜" className={inputClass} />
        <span className="text-slate-400">~</span>
        <input name="to" type="date" required defaultValue={tomorrow} max={tomorrow} aria-label="끝 날짜" className={inputClass} />
        <button type="submit" disabled={pending} className={buttonStyles.primarySmall}>
          {pending ? "요청 중..." : "기간 확인 요청"}
        </button>
      </div>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
