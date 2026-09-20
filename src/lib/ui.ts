// 화면마다 버튼 크기/색이 조금씩 달라지는 걸 막기 위한 공용 스타일 모음.
// 색으로 의미를 구분한다: slate(검정) = 기본/저장, emerald(초록) = 다음 단계로
// 진행(기록지 작성 등), red = 삭제 같은 위험한 동작, 테두리만 있는 버전은
// 덜 중요한 보조 동작.
export const buttonStyles = {
  primary: "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50",
  primarySmall:
    "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50",
  secondary:
    "rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50",
  secondarySmall:
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50",
  danger:
    "rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50",
  accent:
    "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50",
  accentOutline:
    "rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50",
  pill: "rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50",
  // 표/목록 안에서 쓰는 작은 보조 동작 링크(비강 소견 확인, 기록지 작성 등)
  smallOutline: "rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50",
  smallOutlineAccent:
    "rounded-md border border-emerald-600 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50",
  link: "text-sm text-slate-500 hover:underline",
} as const;
