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
        } catch (err) {
          // 사용자가 공유를 취소한 경우(AbortError)는 조용히 끝낸다 — 자동으로
          // 다운로드로 대체하면 취소했는데 파일이 받아지는 게 더 헷갈린다.
          // 그 외의 실패(예: iOS Safari에서 캔버스 렌더링이 오래 걸려 사용자
          // 제스처가 만료되어 share()가 조용히 거부되는 경우)는 아래 새 탭
          // 열기로 이어가서 "아무 반응 없음"으로 끝나지 않게 한다.
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }

      // 공유하기가 안 되거나 실패한 환경 — <a download>는 특히 iOS Safari에서
      // data URL을 조용히 무시해 아무 것도 저장되지 않는 경우가 많아, 대신
      // 새 탭에 이미지를 열어서 길게 누르기(또는 우클릭)로 저장하게 한다.
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank");
      if (!opened) {
        // 팝업이 막힌 경우에는 그래도 다운로드를 한 번 시도해본다.
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
