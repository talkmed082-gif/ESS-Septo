"use client";

import { useState } from "react";
import { buttonStyles } from "@/lib/ui";

// 여러 화면(계획 미리보기, 인쇄용 보기 등)에서 텍스트를 클립보드로 복사할
// 때 공용으로 쓴다 — 병원 EMR 등 다른 곳에 옮겨 적을 때 통째로 복사할 수
// 있게 하기 위함.
export function CopyButton({
  text,
  label = "복사",
  className = buttonStyles.smallOutline,
  disabled = false,
}: {
  text: string;
  label?: string;
  className?: string;
  // 복사할 내용이 없을 때 눌러도 "복사됨"이 뜨지 않게 끈다.
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // 클립보드 접근 불가 - 무시
        }
      }}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {copied ? "복사됨 ✓" : label}
    </button>
  );
}
