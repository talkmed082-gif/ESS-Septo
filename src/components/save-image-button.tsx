"use client";

import { useState } from "react";

// 인쇄용 페이지를 그대로 캡처해서 JPG로 만든다. 폰에서는 공유하기(Web
// Share) 시트를 띄워서 메일/카카오톡 등 원하는 앱으로 바로 보낼 수 있게
// 하고, 공유하기를 지원하지 않는 환경(PC 브라우저 등)에서는 대신 파일로
// 다운로드한다.
export function SaveImageButton({
  targetId,
  fileName,
  shareTitle,
}: {
  targetId: string;
  fileName: string;
  shareTitle: string;
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

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) return;

      const file = new File([blob], fileName, { type: "image/jpeg" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };

      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file], title: shareTitle });
          return;
        } catch {
          // 사용자가 공유를 취소한 경우 등 — 조용히 무시하고 끝낸다
          // (다운로드로 자동 대체하면 취소했는데 파일이 받아지는 게 더 헷갈림).
          return;
        }
      }

      // 공유하기를 지원하지 않는 환경(대부분 PC 브라우저)에서는 파일로 저장
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
      {busy ? "이미지 생성 중..." : "이미지 공유/저장 (JPG)"}
    </button>
  );
}
