"use client";

import { buttonStyles } from "@/lib/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonStyles.primary}>
      인쇄 / PDF 저장
    </button>
  );
}
