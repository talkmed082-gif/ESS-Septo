import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { safeDateStr } from "@/lib/date-format";
import { clinicTabs, SectionTabs } from "@/components/section-tabs";
import { CPAP_VENDORS, CpapSchema, cpapDue, cpapResultText, isCpapFollowUp, smsHref } from "@/lib/cpap";
import { sendToSurgery } from "@/app/actions/clinic-surgery";
import { CpapNoticeSms, CpapRxForm, MailCheckButton } from "./cpap-actions";

// 외래 진료 관리 > 외래 후(사용자 2026-10-27) — 고른 날짜 외래가 끝난 뒤 할 일:
//  ① OSA·CPAP 안내: CPAP 처방 의뢰 문자·시트용 복사, 그날 CPAP F/U 환자(회사 결과·결과 요청 문자)
//  ② 수술환자 정리: 그날 Plan을 수술로 정한 환자 — 수술 계획이 잡혔는지, 안 잡혔으면 [수술환자 관리로]
// 양압기 정보는 노트북이 외래 전 6개월 기록에서 규칙으로 찾아 올린 것(PatientCare.cpap). 본인 데이터만
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default async function AfterClinicPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId } = await verifySession();
  const today = kstDate(new Date());
  const { date: dateParam } = await searchParams;
  const asked = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  // 날짜: 고른 날 → 오늘(명단 있으면) → 가장 최근 지난 외래
  const list = asked
    ? await prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: userId, date: asked } }, select: { date: true, rows: true } })
    : ((await prisma.outpatientList.findMany({ where: { createdById: userId, date: { lte: today } }, orderBy: { date: "desc" }, take: 14, select: { date: true, rows: true } })).find((l) => (l.rows as OutpatientRow[]).length > 0) ?? null);
  const date = asked ?? list?.date ?? today;
  const rows = (list?.rows ?? []) as OutpatientRow[];
  const charts = rows.map((r) => r.chartNo);
  const [cares, patients] = await Promise.all([
    prisma.patientCare.findMany({ where: { createdById: userId, chartNo: { in: charts } }, select: { chartNo: true, cpap: true, planType: true } }),
    prisma.patient.findMany({
      where: { createdById: userId, chartNo: { in: charts } },
      select: { id: true, chartNo: true, opPlans: { where: { status: { not: "DONE" }, opRecord: null }, orderBy: { plannedDate: "asc" }, select: { id: true, plannedDate: true, surgeryType: { select: { name: true } } } } },
    }),
  ]);
  const careOf = new Map(cares.map((c) => [c.chartNo, c]));
  const cpapOf = (chart: string) => { const c = careOf.get(chart); const p = CpapSchema.safeParse(c?.cpap); return p.success && c?.cpap ? p.data : null; };
  const due = rows.flatMap((r) => { const c = cpapOf(r.chartNo); return c && isCpapFollowUp(c, date) ? [{ row: r, cpap: c }] : []; });
  const surgery = rows.filter((r) => careOf.get(r.chartNo)?.planType === "surgery" || patients.some((p) => p.chartNo === r.chartNo && p.opPlans.length > 0));
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const patientsForRx = rows.map((r) => ({ date, time: r.time, name: cpapOf(r.chartNo)?.realName ?? r.name, chartNo: r.chartNo, sex: r.sex ?? "", age: r.age ?? "" }));
  const box = "space-y-3 rounded-lg border border-slate-200 bg-white p-4";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">외래 진료 관리</h1>
      <SectionTabs tabs={clinicTabs(date)} current="/cpap" />
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/cpap?date=${addDays(date, -1)}`} className="rounded border border-slate-300 px-2 py-1" aria-label="전날">‹</Link>
        <span className="font-medium">{date}{date === today ? " (오늘)" : ""} 외래 후 · {rows.length}명</span>
        <Link href={`/cpap?date=${addDays(date, 1)}`} className="rounded border border-slate-300 px-2 py-1" aria-label="다음 날">›</Link>
      </div>

      <section className={box}>
        <h2 className="font-semibold">OSA·CPAP 안내</h2>
        <CpapRxForm patients={patientsForRx} today={date} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">CPAP F/U 환자 {due.length}명 — 결과가 없으면 [결과 요청 문자]. 기록에서 규칙으로 찾은 것이라 처방 문장이 다르게 적혀 있으면 빠질 수 있습니다.</p>
          {due.length > 0 && <MailCheckButton />}
        </div>
        {due.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>{["시간", "이름", "회사", "처방", "설정", "결과"].map((h) => <th key={h} className="py-2 pr-3 font-normal whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {due.map(({ row, cpap }) => {
                  const v = cpap.vendor ? CPAP_VENDORS[cpap.vendor] : undefined;
                  const name = cpap.realName ?? row.name;
                  const got = cpap.report || (cpap.mail?.hits.length ?? 0) > 0;
                  return (
                    <tr key={row.chartNo} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap"><Link href={`/clinic?date=${date}&chart=${row.chartNo}`} className="text-emerald-700 underline">{row.time}</Link></td>
                      <td className="py-2 pr-3 whitespace-nowrap">{name} <span className="text-xs text-slate-500">{row.chartNo}</span></td>
                      <td className="py-2 pr-3">
                        {/* 번호를 누르면 전화가 걸려서(사용자 2026-10-27) 글자로만 — 연락은 처방 안내 문자로 */}
                        <span className="font-medium">{cpap.vendor ?? "?"}</span> <span className="text-xs text-slate-500">{v?.tel ?? "연락처 모름"}</span>
                        {v?.tel && <div className="mt-1"><CpapNoticeSms name={name} tel={v.tel} setting={cpap.setting} /></div>}
                      </td>
                      <td className="py-2 pr-3">{cpap.rxDate && md(cpap.rxDate)} {cpap.months}개월 → {md(cpapDue(cpap) ?? "")}</td>
                      <td className="py-2 pr-3 text-xs">{cpap.setting ?? ""}</td>
                      <td className="py-2 pr-3 text-xs">
                        {cpap.report ? (
                          <span className="text-emerald-700">✓ 결과 받음{cpap.report.expiry ? ` · 처방만료 ${cpap.report.expiry}` : ""}<span className="block whitespace-pre-wrap text-slate-600">{cpap.report.text}</span></span>
                        ) : got ? (
                          <span className="text-emerald-700">✓ 메일 {cpap.mail!.hits.map((h) => md(h.date.slice(0, 10))).join(", ")}</span>
                        ) : (
                          v?.tel && <a href={smsHref(v.tel, cpapResultText({ name, visitDate: date, today }))} className="inline-block rounded bg-emerald-700 px-2 py-1 text-white">결과 요청 문자</a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={box}>
        <h2 className="font-semibold">수술환자 정리</h2>
        <p className="text-sm text-slate-500">이날 외래에서 수술로 정한 환자 {surgery.length}명 — EMR 수술 일정이 올라오면 같은 계획에 날짜가 채워집니다(중복 안 만듦).</p>
        {surgery.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {surgery.map((r) => {
              const p = patients.find((x) => x.chartNo === r.chartNo);
              const plan = p?.opPlans[0];
              return (
                <li key={r.chartNo} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-12 text-xs text-slate-500">{r.time}</span>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-slate-500">{r.chartNo}</span>
                  <span className="text-slate-600">{r.diagnosis}</span>
                  {plan ? (
                    <Link href={`/plans/${plan.id}`} className="ml-auto text-emerald-700 underline">
                      {plan.surgeryType.name} {safeDateStr(plan.plannedDate) ?? "날짜 미정"}
                    </Link>
                  ) : p ? (
                    <Link href={`/patients/${p.id}`} className="ml-auto text-amber-700 underline">수술 계획 아직 없음 — 환자 화면에서 잡기</Link>
                  ) : (
                    <form action={sendToSurgery.bind(null, date, r.chartNo)} className="ml-auto">
                      <button type="submit" className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-700 hover:bg-emerald-50">수술환자 관리로</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
