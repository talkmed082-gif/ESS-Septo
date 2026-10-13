"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ReminderFormState } from "@/app/actions/reminders";
import { buttonStyles } from "@/lib/ui";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function ReminderForm({
  action,
}: {
  action: (state: ReminderFormState | undefined, formData: FormData) => Promise<ReminderFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // 저장되면 다음 입력을 위해 칸을 비운다
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input name="title" required maxLength={100} placeholder="제목" aria-label="리마인더 제목" className={inputClass} />
        <input name="dueDate" type="date" aria-label="만료일" className={inputClass} />
      </div>
      <textarea name="content" rows={2} maxLength={2000} placeholder="내용" aria-label="리마인더 내용" className={inputClass} />
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending} className={buttonStyles.primarySmall}>
        {pending ? "저장 중..." : "리마인더 추가"}
      </button>
    </form>
  );
}
