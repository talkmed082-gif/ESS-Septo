"use client";

import { useActionState } from "react";
import { requestConsultReply } from "@/app/actions/hospital-link";
import { CONSULT_REPLY_MAX } from "@/lib/hospital-link";
import { buttonStyles } from "@/lib/ui";

// 미회신 타과의뢰의 회신 쓰기 — [EMR에 회신 저장]을 누르면 병원 PC가 10분 안에 EMR 회신 기록지에 넣고 저장·일괄서명한다
export function ConsultReplyForm({ id, defaultText }: { id: string; defaultText: string }) {
  const [state, formAction, pending] = useActionState(requestConsultReply, undefined);
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="text"
        rows={5}
        maxLength={CONSULT_REPLY_MAX}
        defaultValue={defaultText}
        aria-label="회신 내용"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonStyles.primarySmall}>
          {pending ? "요청 중..." : "EMR에 회신 저장"}
        </button>
        <span className="text-xs text-slate-400">병원 PC가 10분 안에 EMR에 저장하고 일괄서명까지 합니다.</span>
      </div>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
