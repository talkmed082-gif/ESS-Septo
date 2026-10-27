import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { OUTPATIENT_TABS, SectionTabs } from "@/components/section-tabs";
import { CPAP_VENDORS, CpapSchema, cpapDue, cpapResultText, isCpapFollowUp, smsHref } from "@/lib/cpap";
import { CpapRxForm, MailCheckButton } from "./cpap-actions";

// 진료 > CPAP F/U 환자(사용자 2026-10-27) — 양압기를 몇 달 처방하고 그 기간이 지나 외래에 오는 환자. 외래 전에 결과 메일이 왔는지 보고,
// 안 왔으면 회사 담당자에게 문자(폰에서 문구가 채워진 문자 창 → 직접 전송). 위에는 CPAP 처방 때 의뢰 문자·OSA 시트 등록.
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
  const cpapOf = new Map(cares.flatMap((c) => { const p = CpapSchema.safeParse(c.cpap); return p.success && c.cpap ? [[c.chartNo, p.data] as const] : []; }));
  const due = visits.flatMap((v) => { const c = cpapOf.get(v.row.chartNo); return c && isCpapFollowUp(c, v.date) ? [{ ...v, cpap: c }] : []; });
  const others = visits.filter((v) => cpapOf.has(v.row.chartNo) && !due.some((d) => d.row.chartNo === v.row.chartNo && d.date === v.date)).length;
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  // 처방 등록 칸의 환자 고르기 — 가장 가까운 외래(오늘이면 오늘) 명단
  const nearest = lists.find((l) => (l.rows as OutpatientRow[]).length > 0)?.date;
  const patients = visits.filter((v) => v.date === nearest).map((v) => ({ date: v.date, time: v.row.time, name: cpapOf.get(v.row.chartNo)?.realName ?? v.row.name, chartNo: v.row.chartNo, sex: v.row.sex ?? "", age: v.row.age ?? "" }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">진료</h1>
      <SectionTabs tabs={OUTPATIENT_TABS} current="/cpap" />
      <CpapRxForm patients={patients} today={today} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">양압기 처방 기간이 지나 외래에 오는 환자 — 결과 메일이 없으면 [결과 요청 문자]. 기록에서 규칙으로 찾은 것이라 처방 문장이 다르게 적혀 있으면 빠질 수 있습니다.</p>
        {due.length > 0 && <MailCheckButton />}
      </div>
      {due.length === 0 ? (
        <p className="text-sm text-slate-400">앞으로의 외래에 해당 환자가 없습니다{others > 0 ? ` (양압기 기록은 있지만 처방 기간 중인 환자 ${others}명)` : ""}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                {["외래", "이름", "등록번호", "회사", "처방", "설정", "결과 메일"].map((h) => (
                  <th key={h} className="py-2 pr-3 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {due.map(({ date, row, cpap }) => {
                const v = cpap.vendor ? CPAP_VENDORS[cpap.vendor] : undefined;
                const name = cpap.realName ?? row.name;
                const got = (cpap.mail?.hits.length ?? 0) > 0;
                return (
                  <tr key={`${date}-${row.chartNo}`} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <Link href={`/clinic?date=${date}&chart=${row.chartNo}`} className="text-emerald-700 underline">{md(date)}</Link> {row.time}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{name}</td>
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
                    <td className="py-2 pr-3 text-xs">
                      {got ? (
                        <span className="text-emerald-700">✓ {cpap.mail!.hits.map((h) => `${md(h.date.slice(0, 10))} ${h.subject}`).join(" / ")}</span>
                      ) : (
                        <span className="space-y-1">
                          <span className="block text-slate-500">{cpap.mail ? `없음(${md(cpap.mail.checkedAt.slice(0, 10))} 확인)` : "확인 전"}</span>
                          {v?.tel && (
                            <a href={smsHref(v.tel, cpapResultText({ name, visitDate: date, today }))} className="inline-block rounded bg-emerald-700 px-2 py-1 text-white">
                              결과 요청 문자
                            </a>
                          )}
                          {!cpap.realName && <span className="block text-amber-700">실명 없음 — 문자 이름을 고쳐 보내세요</span>}
                        </span>
                      )}
                    </td>
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
