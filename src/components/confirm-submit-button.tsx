"use client";

import type { ReactNode } from "react";

// 서버 컴포넌트 화면의 삭제 같은 되돌릴 수 없는 폼 제출 앞에 확인창을 띄운다.
export function ConfirmSubmitButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
