"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/password-reset";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-emerald-700">{state.message}</p>
        <Link
          href="/login"
          className="block w-full rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-slate-700"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">새 비밀번호 (8자 이상)</label>
        <input name="newPassword" type="password" autoComplete="new-password" required className={inputClass} />
        {state?.errors?.newPassword && <p className="mt-1 text-sm text-red-600">{state.errors.newPassword[0]}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">새 비밀번호 확인</label>
        <input name="confirmPassword" type="password" autoComplete="new-password" required className={inputClass} />
        {state?.errors?.confirmPassword && (
          <p className="mt-1 text-sm text-red-600">{state.errors.confirmPassword[0]}</p>
        )}
      </div>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "바꾸는 중..." : "비밀번호 바꾸기"}
      </button>
    </form>
  );
}
