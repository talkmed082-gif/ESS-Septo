import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { PrintButton } from "@/components/print-button";

// 수술방에서 내시경 모니터 앞에 붙여두고 손으로 체크하는 용도의 빈 FESS
// 시행 부위 체크리스트. 환자별 데이터에 묶이지 않는 범용 양식이라 A4 한
// 장에 여러 장(4장)을 미리 인쇄해두고 매 케이스마다 한 장씩 쓰면 된다.
const ROWS = [
  "Uncinectomy",
  "MMA (Middle meatal antrostomy)",
  "Ant. ethmoidectomy",
  "Post. ethmoidectomy",
  "Sphenoidotomy",
  "Frontal sinusotomy",
  "중비갑개 축소술",
  "하비갑개 축소술",
];

function ChecklistCard() {
  return (
    <div className="flex flex-col border border-slate-400 p-2 break-inside-avoid">
      <div className="mb-1.5 space-y-1 text-[11px]">
        <div className="flex gap-1">
          <span className="shrink-0 text-slate-500">환자명:</span>
          <span className="flex-1 border-b border-slate-400">&nbsp;</span>
          <span className="shrink-0 text-slate-500">날짜:</span>
          <span className="flex-1 border-b border-slate-400">&nbsp;</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="shrink-0 text-slate-500">☐ Revision case</span>
          <span className="ml-2 shrink-0 text-slate-500">수술명:</span>
          <span className="flex-1 border-b border-slate-400">&nbsp;</span>
        </div>
      </div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="border border-slate-400 bg-slate-50 px-1.5 py-1 text-left font-medium">
              시행 부위
            </th>
            <th className="w-12 border border-slate-400 bg-slate-50 px-1.5 py-1 font-medium">
              우측
            </th>
            <th className="w-12 border border-slate-400 bg-slate-50 px-1.5 py-1 font-medium">
              좌측
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((label) => (
            <tr key={label}>
              <td className="border border-slate-400 px-1.5 py-1">{label}</td>
              <td className="border border-slate-400 text-center text-sm">☐</td>
              <td className="border border-slate-400 text-center text-sm">☐</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FessChecklistPrintPage() {
  await verifySession();

  return (
    <div className="mx-auto w-full max-w-3xl bg-white p-3 text-slate-900 sm:p-8 print:max-w-none print:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/patients" className="text-sm text-slate-500 hover:underline">
          ← 목록으로 돌아가기
        </Link>
        <PrintButton />
      </div>
      <p className="mb-3 text-xs text-slate-500 print:hidden">
        환자 데이터와 무관한 빈 양식입니다. A4 한 장에 4장씩 나오도록 되어 있어, 미리 여러 장
        인쇄해두고 수술방에서 케이스마다 한 장씩 손으로 체크해서 쓰면 됩니다.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-4">
        <ChecklistCard />
        <ChecklistCard />
        <ChecklistCard />
        <ChecklistCard />
      </div>
    </div>
  );
}
