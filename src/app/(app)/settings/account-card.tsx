"use client";

import { useActionState, useRef } from "react";
import { changePassword, logoutOtherDevices, type AccountFormState } from "@/app/actions/auth";
import { buttonStyles } from "@/lib/ui";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="mt-1 text-sm text-red-600">{errors[0]}</p> : null;
}

// 비밀번호 변경과 "다른 기기 로그아웃" — 둘 다 세션 버전을 올려 다른 기기의
// 로그인을 끊는다(폰 분실 시 대비).
export function AccountCard() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pwState, pwAction, pwPending] = useActionState<AccountFormState | undefined, FormData>(
    async (prev, formData) => {
      const result = await changePassword(prev, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    undefined,
  );
  const [logoutState, logoutAction, logoutPending] = useActionState<AccountFormState | undefined, FormData>(
    () => logoutOtherDevices(),
    undefined,
  );

  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <form ref={formRef} action={pwAction} className="space-y-3">
        <p className="text-sm font-medium text-slate-700">비밀번호 변경</p>
        <div>
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            placeholder="현재 비밀번호"
            className={inputClass}
          />
          <FieldError errors={pwState?.errors?.currentPassword} />
        </div>
        <div>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            placeholder="새 비밀번호 (8자 이상)"
            className={inputClass}
          />
          <FieldError errors={pwState?.errors?.newPassword} />
        </div>
        <div>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="새 비밀번호 확인"
            className={inputClass}
          />
          <FieldError errors={pwState?.errors?.confirmPassword} />
        </div>
        {pwState?.message && (
          <p className={`text-sm ${pwState.ok ? "text-emerald-700" : "text-red-600"}`}>{pwState.message}</p>
        )}
        <button type="submit" disabled={pwPending} className={buttonStyles.secondary}>
          {pwPending ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>

      <form
        action={logoutAction}
        onSubmit={(e) => {
          if (!window.confirm("지금 쓰는 기기만 남기고 다른 기기의 로그인을 모두 끊을까요?")) e.preventDefault();
        }}
        className="space-y-2 border-t border-slate-100 pt-4"
      >
        <p className="text-sm text-slate-500">폰을 잃어버렸을 때처럼, 다른 기기에 남은 로그인을 끊습니다.</p>
        {logoutState?.message && <p className="text-sm text-emerald-700">{logoutState.message}</p>}
        <button type="submit" disabled={logoutPending} className={buttonStyles.secondary}>
          {logoutPending ? "처리 중..." : "다른 기기 모두 로그아웃"}
        </button>
      </form>
    </div>
  );
}
