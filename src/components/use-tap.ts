import { useRef } from "react";

// 폰에서 빠르게 연타하면 브라우저가 탭을 click으로 바꿔주지 못하고 놓치는 일이
// 있어서(스크롤 판정, 손가락 미세 이동 등), 손가락을 떼는 순간(pointerup)에 바로
// 실행하고 뒤따라오는 click은 중복 실행하지 않는다. 키보드(Enter/Space)처럼
// 포인터 없이 오는 click(detail 0)은 그대로 처리한다.
const TAP_SLOP_PX = 16;
const CLICK_DEDUPE_MS = 600;

export function useTap(onTap: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const lastPointerTapAt = useRef(0);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > TAP_SLOP_PX) return;
      lastPointerTapAt.current = Date.now();
      onTap();
    },
    onPointerCancel: () => {
      start.current = null;
    },
    onClick: (e: React.MouseEvent) => {
      if (e.detail !== 0 && Date.now() - lastPointerTapAt.current < CLICK_DEDUPE_MS) return;
      onTap();
    },
  };
}
