"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/password-reset";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">비밀번호 찾기</h1>
        <p className="mb-6 text-sm text-slate-500">가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.</p>
        {state?.ok ? (
          <p className="text-sm text-emerald-700">{state.message}</p>
        ) : (
          <form action={action} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">이메일</label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              {state?.errors?.email && <p className="mt-1 text-sm text-red-600">{state.errors.email[0]}</p>}
            </div>
            {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? "보내는 중..." : "재설정 링크 받기"}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="text-slate-900 underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
