import Link from "next/link";
import { PROFESSORS, type ProfSurgery } from "@/lib/prof-schedule";

type ProfDay = { doctor: string; outpatient: number; surgeries: ProfSurgery[]; cancelled: ProfSurgery[]; off: string | null };

// 메인 — 교수님 네 분의 2주 외래 인원·수술·휴가(사용자 2026-10-27 "교수님들 외래 숫자, 휴가 오전/오후 반차·연차도 다"). 평일만, 취소된 수술(66·77·88·99번 방)은 따로
export function ProfTable({ dates, today, profs }: { dates: string[]; today: string; profs: Map<string, ProfDay[]> }) {
  const days = dates.filter((d) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return w !== 0 && w !== 6; });
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${"일월화수목금토"[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="py-1.5 pr-2 font-normal">날짜</th>
            {PROFESSORS.map((p) => <th key={p} className="py-1.5 pr-2 font-normal whitespace-nowrap">{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d} className={`border-b border-slate-100 align-top ${d === today ? "bg-emerald-50" : ""}`}>
              <td className="py-1.5 pr-2 whitespace-nowrap"><Link href={`/dashboard?day=${d}#day`} className="hover:underline">{md(d)}</Link></td>
              {PROFESSORS.map((name) => {
                const p = profs.get(d)?.find((x) => x.doctor === name);
                return (
                  <td key={name} className="py-1.5 pr-2">
                    {p?.off && <span className={`mr-1 rounded px-1 ${p.off.includes("반차") ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>{p.off}</span>}
                    {p && p.outpatient > 0 && <span className="mr-1">외래 {p.outpatient}</span>}
                    {p && p.surgeries.length > 0 && <span className="mr-1">수술 {p.surgeries.length}</span>}
                    {p && p.cancelled.length > 0 && <span className="text-slate-400 line-through">취소 {p.cancelled.length}</span>}
                    {(!p || (!p.off && !p.outpatient && !p.surgeries.length && !p.cancelled.length)) && <span className="text-slate-300">-</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
