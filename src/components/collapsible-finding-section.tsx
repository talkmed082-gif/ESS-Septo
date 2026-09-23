import type { ReactNode } from "react";

// "Septoturbinoplasty P/E" / "ESS P/E" 소견 그룹 — 예전엔 이 섹션을 보여줄지
// 자체 체크박스로 다시 한번 확인했지만, 어차피 위쪽 수술 종류 선택(Septo/ESS)에
// 따라 이 섹션 자체를 보여줄지 말지(showSeptum/showSinus)가 이미 정해지므로
// 이중 체크였다 — 이제 이 섹션이 보이면 곧 "시행함"이라 doneKey를 항상
// true로 숨겨서 제출하고, 내용은 항상 펼쳐서 보여준다.
export function CollapsibleFindingSection({
  doneKey,
  label,
  children,
}: {
  doneKey: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <input type="hidden" name={`field_${doneKey}`} value="on" />
      <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
