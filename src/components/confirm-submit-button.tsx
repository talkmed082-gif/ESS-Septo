"use client";

import type { ReactNode } from "react";

// 서버 컴포넌트 화면의 삭제 같은 되돌릴 수 없는 폼 제출 앞에 확인창을 띄운다.
export function ConfirmSubmitButton({
  message,
  className,
  children,
  form,
}: {
  message: string;
  className?: string;
  children: ReactNode;
  // 다른 폼 안에 놓일 때 — 폼은 겹칠 수 없어서 바깥 폼을 id로 가리킨다
  form?: string;
}) {
  return (
    <button
      type="submit"
      form={form}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
