"use client";

import { CHECK_MARK } from "@/components/check-cell";
import { useTap } from "@/components/use-tap";

export function MatrixCellButton({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  const tap = useTap(onToggle);
  return (
    <button
      type="button"
      {...tap}
      // ::before로 눌리는 영역을 칸 전체로 넓힌다(24px 버튼 밖 여백을 눌러도 반응).
      // 누르는 즉시 색이 바뀌는 :active는 CSS라 JS 비용이 없다.
      className={`relative h-6 w-6 rounded touch-manipulation before:absolute before:-inset-x-7 before:-inset-y-1.5 before:content-[''] ${
        checked
          ? "bg-emerald-600 text-white active:bg-emerald-700"
          : "bg-slate-100 text-transparent hover:bg-slate-200 active:bg-slate-300"
      }`}
    >
      {CHECK_MARK}
    </button>
  );
}
