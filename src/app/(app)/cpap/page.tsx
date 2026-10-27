import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { OUTPATIENT_TABS, SectionTabs } from "@/components/section-tabs";
import { CPAP_VENDORS, CpapSchema, cpapDue, isCpapFollowUp } from "@/lib/cpap";

// 진료 > CPAP F/U 환자(사용자 2026-10-27) — 양압기를 몇 달 처방하고 그 기간이 지나 외래에 오는 환자. 외래 전에 양압기 회사에 연락해 사용 결과를 받는다.
// 양압기 정보는 노트북이 외래 전 6개월 기록에서 규칙으로 찾아 올린 것(PatientCare.cpap). 오늘부터 앞으로의 외래 명단만, 본인 데이터만
export default async function CpapPage() {
  const { userId } = await verifySession();
  const today = kstDate(new Date());
  const lists = await prisma.outpatientList.findMany({ where: { createdById: userId, date: { gte: today } }, orderBy: { date: "asc" }, select: { date: true, rows: true } });
  const visits = lists.flatMap((l) => (l.rows as OutpatientRow[]).map((r) => ({ date: l.date, row: r })));
  const cares = await prisma.patientCare.findMany({
    where: { createdById: userId, chartNo: { in: [...new Set(visits.map((v) => v.row.chartNo))] } },
    select: { chartNo: true, cpap: true },
  });
  const cpapOf = new Map(cares.flatMap((c) => { const p = CpapSchema.safeParse(c.cpap); return p.success ? [[c.chartNo, p.data] as const] : []; }));
  const due = visits.flatMap((v) => { const c = cpapOf.get(v.row.chartNo); return c && isCpapFollowUp(c, v.date) ? [{ ...v, cpap: c }] : []; });
  const others = visits.filter((v) => cpapOf.has(v.row.chartNo) && !due.some((d) => d.row.chartNo === v.row.chartNo && d.date === v.date)).length;
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">진료</h1>
      <SectionTabs tabs={OUTPATIENT_TABS} current="/cpap" />
      <p className="text-sm text-slate-500">양압기 처방 기간이 지나 외래에 오는 환자 — 외래 전에 회사에 연락해 사용 결과를 받으세요. 기록에서 규칙으로 찾은 것이라 처방 문장이 다르게 적혀 있으면 빠질 수 있습니다.</p>
      {due.length === 0 ? (
        <p className="text-sm text-slate-400">앞으로의 외래에 해당 환자가 없습니다{others > 0 ? ` (양압기 기록은 있지만 처방 기간 중인 환자 ${others}명)` : ""}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                {["외래", "이름", "등록번호", "회사", "처방", "설정"].map((h) => (
                  <th key={h} className="py-2 pr-3 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {due.map(({ date, row, cpap }) => {
                const v = cpap.vendor ? CPAP_VENDORS[cpap.vendor] : undefined;
                return (
                  <tr key={`${date}-${row.chartNo}`} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <Link href={`/clinic?date=${date}&chart=${row.chartNo}`} className="text-emerald-700 underline">{md(date)}</Link> {row.time}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.name}</td>
                    <td className="py-2 pr-3">{row.chartNo}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="font-medium">{cpap.vendor ?? "?"}</span>{" "}
                      {v?.tel ? <a href={`tel:${v.tel}`} className="text-emerald-700 underline">{v.tel}</a> : <span className="text-xs text-slate-400">연락처 모름</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {cpap.rxDate && md(cpap.rxDate)} {cpap.months}개월 → {md(cpapDue(cpap) ?? "")}
                      {cpap.rxLine && <span className="block text-xs text-slate-500">{cpap.rxLine}</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs">{cpap.setting ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
