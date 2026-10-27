import { prisma } from "@/lib/prisma";
import type { OutpatientRow } from "@/lib/hospital-link";
import { CPAP_VENDORS, CpapSchema, cpapDue, cpapResultText, isCpapFollowUp, smsHref } from "@/lib/cpap";
import { MailCheckButton } from "./cpap-actions";

// 외래 전 준비 — 그날 CPAP F/U 환자(양압기 처방 기간이 끝나 오는 환자)의 결과 확인(사용자 2026-10-27 "CPAP F/U는 외래 전에, 결과 확인도 여기서").
// 회사 결과(데이터 PDF·보고서)·메일이 있으면 ✓, 없으면 [결과 요청 문자]. 회사 연락처는 띄우지 않음(표가 커서)
export async function CpapFollowUp({ userId, date, today, rows }: { userId: string; date: string; today: string; rows: OutpatientRow[] }) {
  const cares = await prisma.patientCare.findMany({ where: { createdById: userId, chartNo: { in: rows.map((r) => r.chartNo) } }, select: { chartNo: true, cpap: true } });
  const due = rows.flatMap((r) => {
    const c = cares.find((x) => x.chartNo === r.chartNo);
    const p = CpapSchema.safeParse(c?.cpap);
    return p.success && c?.cpap && isCpapFollowUp(p.data, date) ? [{ row: r, cpap: p.data }] : [];
  });
  if (!due.length) return null;
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">CPAP F/U {due.length}명 — 양압기 결과 확인</h2>
        <MailCheckButton />
      </div>
      <ul className="divide-y divide-slate-100">
        {due.map(({ row, cpap }) => {
          const v = cpap.vendor ? CPAP_VENDORS[cpap.vendor] : undefined;
          const name = cpap.realName ?? row.name;
          const mail = cpap.mail?.hits.length ? cpap.mail.hits : null;
          return (
            <li key={row.chartNo} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              <span className="w-11 text-xs text-slate-500">{row.time}</span>
              <span className="font-medium">{name}</span>
              <span className="text-xs text-slate-500">{cpap.vendor ?? "?"} · {cpap.setting ?? ""} · {cpap.rxDate && md(cpap.rxDate)} {cpap.months}개월 → {md(cpapDue(cpap) ?? "")}</span>
              <span className="ml-auto text-xs">
                {cpap.report ? (
                  <details className="inline-block">
                    <summary className="cursor-pointer text-emerald-700">✓ 결과 받음{cpap.report.expiry ? ` · 만료 ${cpap.report.expiry}` : ""}</summary>
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">{cpap.report.text}</p>
                  </details>
                ) : mail ? (
                  <span className="text-emerald-700">✓ 메일 {mail.map((h) => md(h.date.slice(0, 10))).join(", ")}</span>
                ) : v?.tel ? (
                  <a href={smsHref(v.tel, cpapResultText({ name, visitDate: date, today }))} className="rounded bg-emerald-700 px-2 py-1 text-white">결과 요청 문자</a>
                ) : (
                  <span className="text-slate-400">결과 없음(회사 연락처 모름)</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
