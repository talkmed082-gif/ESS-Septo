"use client";

import { useActionState } from "react";
import { requestErOncall } from "@/app/actions/er-visits";
import { buttonStyles } from "@/lib/ui";

// 온콜대장 미리보기 + [온콜대장 신청] — 시각은 병원 PC 제안(호출 = 응급실 도착 + 15분, 도착·종료 = 내 기록지 시각 기준), 고쳐서 신청할 수 있다
export function OncallForm({ id, call, arrive, end }: { id: string; call: string; arrive: string; end: string }) {
  const [state, formAction, pending] = useActionState(requestErOncall, undefined);
  const input = "rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none";
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          호출 <input type="time" name="call" defaultValue={call} required className={input} />
        </label>
        <label className="flex items-center gap-1">
          도착 <input type="time" name="arrive" defaultValue={arrive} required className={input} />
        </label>
        <label className="flex items-center gap-1">
          종료 <input type="time" name="end" defaultValue={end} required className={input} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonStyles.primarySmall}>
          {pending ? "신청 중..." : "온콜대장 신청"}
        </button>
        <span className="text-xs text-slate-400">
          응급의료센터 · 12.당일 당직자 응급실 진료 · 사유·처치 &quot;응급환자 진료&quot; — 병원 PC가 10분 안에 저장합니다.
        </span>
      </div>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
