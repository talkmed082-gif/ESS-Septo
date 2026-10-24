import Link from "next/link";
import { buttonStyles } from "@/lib/ui";

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

// 외래 명단 월 달력 — 명단이 있는 날은 인원 수, 누르면 그날 명단
export function OutpatientCalendar({
  month,
  counts,
  selected,
  today,
}: {
  month: string;
  counts: Record<string, number>;
  selected?: string;
  today: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  return (
    <div className="max-w-md space-y-2">
      <div className="flex items-center justify-between">
        <Link href={`/outpatient?month=${shiftMonth(month, -1)}`} className={buttonStyles.smallOutline} aria-label="이전 달">
          ←
        </Link>
        <span className="font-medium">
          {y}년 {m}월
        </span>
        <Link href={`/outpatient?month=${shiftMonth(month, 1)}`} className={buttonStyles.smallOutline} aria-label="다음 달">
          →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <span key={d} className="py-1 text-slate-400">
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const n = counts[date];
          const day = Number(date.slice(8));
          const base = "flex h-12 flex-col items-center justify-center rounded-md border text-sm";
          const tone =
            date === selected
              ? "border-slate-900 bg-slate-900 text-white"
              : n !== undefined
                ? "border-emerald-300 bg-emerald-50 text-slate-900 hover:bg-emerald-100"
                : "border-slate-100 text-slate-400";
          const label = (
            <>
              <span className={date === today ? "font-semibold underline" : ""}>{day}</span>
              {n !== undefined && <span className="text-[10px]">{n}명</span>}
            </>
          );
          return n !== undefined ? (
            <Link key={date} href={`/outpatient?date=${date}`} className={`${base} ${tone}`}>
              {label}
            </Link>
          ) : (
            <span key={date} className={`${base} ${tone}`}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
