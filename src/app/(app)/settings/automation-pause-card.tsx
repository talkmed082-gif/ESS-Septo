import { createAutomationPause, deleteAutomationPause } from "@/app/actions/automation-pause";
import { buttonStyles } from "@/lib/ui";

const inputClass = "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

// 자동화 쉬는 날 — 출장 등으로 병원에 없는 날. 그 기간에는 병원 PC가 EMR에 접속하는 작업(수술 일정·리마인더·외래 명단·SOAP)을
// 모두 건너뛴다. 지난 기간은 보이지 않는다.
export function AutomationPauseCard({
  pauses,
  today,
}: {
  pauses: { id: string; from: string; to: string; note: string | null }[];
  today: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div>
        <p className="font-medium text-slate-800">자동화 쉬는 날</p>
        <p className="mt-1 text-slate-500">
          출장 등으로 병원에 없는 기간을 넣으면, 그 기간에는 병원 PC가 EMR에 접속하는 작업(수술 일정·리마인더·외래 명단·SOAP)을
          모두 건너뜁니다. 작업이 도는 날짜 기준입니다(예: 월요일 저녁 외래 명단은 월요일이 쉬는 날이면 건너뜀).
        </p>
      </div>
      {pauses.length === 0 && <p className="text-slate-400">예정된 쉬는 날이 없습니다.</p>}
      {pauses.map((p) => (
        <form key={p.id} action={deleteAutomationPause.bind(null, p.id)} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          <span className={p.from <= today ? "font-medium text-amber-700" : ""}>
            {p.from === p.to ? p.from : `${p.from} ~ ${p.to}`}
            {p.from <= today && " (지금 쉬는 중)"}
          </span>
          {p.note && <span className="text-slate-500">{p.note}</span>}
          <button type="submit" className={buttonStyles.smallOutline}>
            삭제
          </button>
        </form>
      ))}
      <form action={createAutomationPause} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">시작</span>
          <input type="date" name="from" required min={today} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">끝(하루면 비워 두기)</span>
          <input type="date" name="to" min={today} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">메모</span>
          <input name="note" maxLength={60} placeholder="예: 학회 출장" className={inputClass} />
        </label>
        <button type="submit" className={buttonStyles.primarySmall}>
          추가
        </button>
      </form>
    </div>
  );
}
