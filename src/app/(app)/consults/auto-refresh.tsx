"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 타과의뢰 화면을 다른 탭·앱에 갔다가 돌아왔을 때 한 번 다시 읽는다(사용자 2026-10-26 "새로고침 되게").
// 1분 타이머는 Vercel 사용량 때문에 뺐다(같은 날 "버셀 사용 한도 오버된다"). 회신 쓰는 중(글 칸에 포커스)이면 건너뛴다
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (document.activeElement?.tagName === "TEXTAREA") return;
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
  return null;
}
