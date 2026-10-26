"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 타과의뢰 화면을 1분마다 다시 읽는다(병원 PC가 10분마다 새 의뢰를 올림 — 사용자 2026-10-26 "새로고침 되게").
// 화면이 안 보일 때(다른 탭)는 쉬고, 다시 보이면 바로 한 번. 회신 쓰는 중이면(글 칸에 포커스) 건너뛴다
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (document.activeElement?.tagName === "TEXTAREA") return;
      router.refresh();
    };
    const id = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
