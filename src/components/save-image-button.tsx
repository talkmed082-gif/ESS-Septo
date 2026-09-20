"use client";

import { useState } from "react";
import { buttonStyles } from "@/lib/ui";

// 인쇄용 페이지를 그대로 캡처해서 JPG로 만든다. 폰에서는 공유하기(Web
// Share) 시트를 띄워서 메일/카카오톡 등 원하는 앱으로 바로 보낼 수 있게
// 하고, 공유하기를 지원하지 않는 환경(PC 브라우저 등)에서는 대신 파일로
// 다운로드한다.
//
// html2canvas(원조 패키지)는 Tailwind CSS 4가 기본으로 쓰는 oklch() 색상
// 함수를 못 읽어서 캡처 중 조용히 실패한다(버튼이 "생성 중..."으로 잠깐
// 바뀌었다가 아무 일도 없었던 것처럼 끝남) — 그래서 oklch/lab 등 최신 색상
// 함수를 지원하는 fork인 html2canvas-pro를 대신 쓴다.
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
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const el = document.getElementById(targetId);
    if (!el) return;
    setBusy(true);
    setError(null);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
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
    } catch (err) {
      // 예전엔 실패가 조용히 묻혀서 "안 눌리는 것처럼" 보였다 — 원인을 바로
      // 알 수 있게 화면에도 띄운다.
      console.error("이미지 생성/공유 실패", err);
      setError("이미지 생성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={buttonStyles.secondary}
      >
        {busy ? "이미지 생성 중..." : "이미지 공유/저장 (JPG)"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
