"use client";

import type { ReactNode } from "react";
import { useTap } from "@/components/use-tap";

// 폰에서 빠르게 연타해도 탭이 씹히지 않는 버튼 — 손가락을 떼는 순간 바로
// 실행한다(use-tap 참고). 누르는 동안 버튼을 줄이는 효과(scale)는 손가락이
// 버튼 밖으로 벗어나 탭이 취소될 수 있어서 쓰지 않고, 색만 살짝 바꿔 즉시
// 눌림을 보여준다(CSS라 JS 비용 없음).
export function TapButton({
  onTap,
  className = "",
  children,
}: {
  onTap: () => void;
  className?: string;
  children: ReactNode;
}) {
  const tap = useTap(onTap);
  return (
    <button type="button" {...tap} className={`touch-manipulation active:brightness-90 ${className}`}>
      {children}
    </button>
  );
}
