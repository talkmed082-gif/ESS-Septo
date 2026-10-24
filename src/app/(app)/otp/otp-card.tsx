"use client";

import { useActionState } from "react";
import { issueOtp, type OtpState } from "@/app/actions/device";
import { buttonStyles } from "@/lib/ui";

// 진료실 PC 프로그램 연결 코드 — 프로그램을 켤 때마다 한 번, 끄면 연결이 끊긴다
export function OtpCard({ activeCount, endAll }: { activeCount: number; endAll: () => Promise<void> }) {
  const [state, action, pending] = useActionState<OtpState>(issueOtp, undefined);
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <form action={action}>
        <button type="submit" disabled={pending} className="w-full rounded-md bg-slate-900 px-4 py-3 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {pending ? "만드는 중..." : state ? "새 코드 받기" : "연결 코드 받기"}
        </button>
      </form>
      {state && (
        <div className="text-center">
          <p className="font-mono text-5xl font-semibold tracking-[0.3em] text-slate-900">{state.code}</p>
          <p className="mt-2 text-xs text-slate-500">{state.until}까지, 한 번만 쓰임</p>
        </div>
      )}
      <p className="text-xs text-slate-500">
        외래 도우미(OpdHelper)를 켜면 코드를 묻습니다. 프로그램을 끄면 연결이 끊기고, 다음에 켤 때 새 코드를 받습니다.
      </p>
      {activeCount > 0 && (
        <form action={endAll} className="flex items-center gap-2 text-xs">
          <span>지금 연결된 프로그램 {activeCount}개</span>
          <button type="submit" className={buttonStyles.smallOutline}>
            모두 끊기
          </button>
        </form>
      )}
    </div>
  );
}
