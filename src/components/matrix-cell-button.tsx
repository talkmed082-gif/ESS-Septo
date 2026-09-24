"use client";

import { useRef } from "react";
import { CHECK_MARK } from "@/components/check-cell";

// 폰에서 셀을 빠르게 연타하면 브라우저가 탭을 click으로 바꿔주지 못하고
// 놓치는 일이 있어서(스크롤 판정, 손가락 미세 이동 등), 손가락을 떼는 순간
// (pointerup)에 바로 토글하고 뒤따라오는 click은 중복 반영하지 않는다.
// 키보드(Enter/Space)처럼 포인터 없이 오는 click(detail 0)은 그대로 처리한다.
const TAP_SLOP_PX = 16;
const CLICK_DEDUPE_MS = 600;

export function MatrixCellButton({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const lastPointerToggleAt = useRef(0);

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > TAP_SLOP_PX) return;
        lastPointerToggleAt.current = Date.now();
        onToggle();
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onClick={(e) => {
        if (e.detail !== 0 && Date.now() - lastPointerToggleAt.current < CLICK_DEDUPE_MS) return;
        onToggle();
      }}
      // ::before로 눌리는 영역을 칸 전체로 넓힌다(24px 버튼 밖 여백을 눌러도 반응).
      className={`relative h-6 w-6 rounded touch-manipulation before:absolute before:-inset-x-7 before:-inset-y-2 before:content-[''] ${
        checked ? "bg-emerald-600 text-white" : "bg-slate-100 text-transparent hover:bg-slate-200"
      }`}
    >
      {CHECK_MARK}
    </button>
  );
}
