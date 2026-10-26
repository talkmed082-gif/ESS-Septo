"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// 화면 맨 위에서 아래로 당기면 새로고침(사용자 2026-10-26). 홈 화면에 추가한 앱(standalone)에서만 —
// 사파리 브라우저는 자체 당겨서 새로고침이 있어 같이 켜면 두 번 새로 읽는다. 화면 데이터만 다시 받는다(router.refresh)
const THRESHOLD = 70;

export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [pending, start] = useTransition();
  const startY = useRef<number | null>(null);
  const dist = useRef(0);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    const down = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
      dist.current = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY.current === null) return;
      const d = e.touches[0].clientY - startY.current;
      if (d <= 0 || window.scrollY > 0) {
        dist.current = 0;
        setPull(0);
        return;
      }
      dist.current = Math.min(d * 0.5, 110);
      setPull(dist.current);
    };
    const up = () => {
      if (startY.current !== null && dist.current >= THRESHOLD) start(() => router.refresh());
      startY.current = null;
      dist.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [router]);

  if (!pull && !pending) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center" style={{ transform: `translateY(${pending ? 12 : pull - 30}px)` }}>
      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow">
        {pending ? "새로 읽는 중…" : ready ? "놓으면 새로고침" : "당겨서 새로고침"}
      </span>
    </div>
  );
}
