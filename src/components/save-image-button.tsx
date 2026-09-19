"use client";

import { useState } from "react";

// 인쇄용 페이지를 그대로 캡처해서 JPG로 저장한다 — 폰에서 바로 보거나
// 메신저로 공유하려면 PDF/인쇄보다 사진 한 장이 훨씬 편하다는 요청 반영.
export function SaveImageButton({
  targetId,
  fileName,
}: {
  targetId: string;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const el = document.getElementById(targetId);
    if (!el) return;
    setBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {busy ? "이미지 생성 중..." : "이미지로 저장 (JPG)"}
    </button>
  );
}
