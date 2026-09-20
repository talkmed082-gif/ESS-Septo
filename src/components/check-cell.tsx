export const CHECK_MARK = String.fromCharCode(0x2713);

// 이미 값이 정해진(자동 채워진) 표는 굳이 체크박스 모양을 그릴 필요가 없다 —
// 표 자체가 이미 칸으로 나뉘어 있으니, 체크된 칸만 색을 채워서 바로 눈에
// 띄게 한다. Op Plan 표(plan-table.tsx)와 수술방 체크리스트(fess-checklist)
// 양쪽에서 같이 쓴다.
export function DataCell({ checked, className = "" }: { checked: boolean; className?: string }) {
  return (
    <td
      className={`border border-slate-400 text-center font-bold ${
        checked ? "bg-slate-800 text-white" : ""
      } ${className}`}
    >
      {checked ? CHECK_MARK : ""}
    </td>
  );
}

// 표 밖의 단독 항목(Revision case 등)이나 손으로 체크하는 빈 양식에서 쓰는
// 테두리 박스 — Unicode 체크박스 글자는 글꼴에 따라 너무 작거나 흐리게
// 나와서 CSS로 직접 그린다.
export function CheckBox({ checked = false }: { checked?: boolean }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center border-2 border-slate-700 align-middle">
      {checked && <span className="text-sm leading-none font-bold text-slate-900">{CHECK_MARK}</span>}
    </span>
  );
}
