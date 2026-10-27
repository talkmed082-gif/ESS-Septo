import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { safeDateStr } from "@/lib/date-format";
import { clinicTabs, SectionTabs } from "@/components/section-tabs";
import { CPAP_VENDORS, CpapSchema, cpapDue } from "@/lib/cpap";
import { sendToSurgery } from "@/app/actions/clinic-surgery";
import { CpapNoticeSms, CpapRxForm } from "./cpap-actions";
import { UnsignedNotes } from "./unsigned-notes";
import { isNoteDone, parseNoteState } from "@/lib/note-cleanup";

// 외래 진료 관리 > 외래 후(사용자 2026-10-27) — 고른 날짜 외래가 끝난 뒤:
//  ① 서명 전 기록지: 노트북이 저장한 기록지 — [EMR에서 확인] → 안 온 환자 후보 [삭제 승인] → 노트북이 EMR에서 지움(note-cleanup.ts), 직접 처리 표시도
//  ② CPAP: 외래 진행 중 Plan을 CPAP으로 고른 환자 + 그날 온 CPAP F/U 환자 → [처방 안내 문자](보내면 다음 F/U를 그날 + 개월로), 새 CPAP 의뢰 문자는 접어 둠
//  ③ 수술환자 정리: Plan 수술·수술 계획이 있는 환자
// 본인 데이터만
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const hm = (d: Date) => d.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

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
  const [cares, patients, jobs, marks] = await Promise.all([
    prisma.patientCare.findMany({ where: { createdById: userId, chartNo: { in: charts } }, select: { chartNo: true, cpap: true, planType: true } }),
    prisma.patient.findMany({
      where: { createdById: userId, chartNo: { in: charts } },
      select: { id: true, chartNo: true, opPlans: { where: { status: { not: "DONE" }, opRecord: null }, orderBy: { plannedDate: "asc" }, select: { id: true, plannedDate: true, surgeryType: { select: { name: true } } } } },
    }),
    prisma.opdJob.findMany({ where: { createdById: userId, visitDate: date, status: "done" }, select: { id: true, chartNo: true, result: true, noteState: true, updatedAt: true } }),
    prisma.clinicMark.findMany({ where: { createdById: userId, visitDate: date }, select: { chartNo: true } }),
  ]);
  const careOf = new Map(cares.map((c) => [c.chartNo, c]));
  const cpapOf = (chart: string) => { const c = careOf.get(chart); const p = CpapSchema.safeParse(c?.cpap); return p.success && c?.cpap ? p.data : null; };
  const opened = new Set(marks.map((m) => m.chartNo.replace(/^0+/, "")));
  const rowOf = (chart: string) => rows.find((r) => r.chartNo === chart);

  // ① 서명 전 기록지(노트북이 "기록지 저장됨")
  const unsigned = jobs
    .filter((j) => (j.result ?? "").includes("기록지 저장됨"))
    .map((j) => ({ id: j.id, time: rowOf(j.chartNo)?.time ?? "", name: cpapOf(j.chartNo)?.realName ?? rowOf(j.chartNo)?.name ?? "", chartNo: j.chartNo, savedAt: hm(j.updatedAt), opened: opened.has(j.chartNo.replace(/^0+/, "")), state: j.noteState }))
    .sort((a, b) => a.time.localeCompare(b.time));
  // ② CPAP — Plan CPAP 또는 양압기 기록이 있는 그날 환자
  const cpapRows = rows.filter((r) => careOf.get(r.chartNo)?.planType === "cpap" || cpapOf(r.chartNo)?.vendor);
  const newCpap = rows.filter((r) => careOf.get(r.chartNo)?.planType === "cpap" && !cpapOf(r.chartNo)?.vendor);
  // ③ 수술
  const surgery = rows.filter((r) => careOf.get(r.chartNo)?.planType === "surgery" || patients.some((p) => p.chartNo === r.chartNo && p.opPlans.length > 0));
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const box = "space-y-3 rounded-lg border border-slate-200 bg-white p-4";

  return (
    <div className="space-y-4">
      <SectionTabs tabs={clinicTabs(date)} current="/cpap" />
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/cpap?date=${addDays(date, -1)}`} className="rounded border border-slate-300 px-2 py-1" aria-label="전날">‹</Link>
        <span className="font-medium">{date}{date === today ? " (오늘)" : ""} 외래 후 · {rows.length}명</span>
        <Link href={`/cpap?date=${addDays(date, 1)}`} className="rounded border border-slate-300 px-2 py-1" aria-label="다음 날">›</Link>
      </div>

      <section className={box}>
        <h2 className="font-semibold">서명 전 기록지 {unsigned.filter((u) => !isNoteDone(parseNoteState(u.state))).length}건</h2>
        <UnsignedNotes notes={unsigned} date={date} />
      </section>

      <section className={box}>
        <h2 className="font-semibold">CPAP {cpapRows.length}명</h2>
        {cpapRows.length === 0 ? <p className="text-sm text-slate-400">이날 CPAP 환자가 없습니다(외래 진행 중 Plan에서 CPAP을 고르면 여기에).</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {cpapRows.map((r) => {
              const c = cpapOf(r.chartNo);
              const v = c?.vendor ? CPAP_VENDORS[c.vendor] : undefined;
              const name = c?.realName ?? r.name;
              const sent = c?.notice && c.notice.date === date ? hm(new Date(c.notice.at)) : null;
              return (
                <li key={r.chartNo} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="w-11 text-xs text-slate-500">{r.time}</span>
                  <span className="font-medium">{name}</span>
                  <span className="text-xs text-slate-500">{c?.vendor ?? "회사 미정"}{c?.setting ? ` · ${c.setting}` : ""}{c?.rxDate ? ` · 다음 F/U ${md(cpapDue(c) ?? "")}` : ""}</span>
                  <span className="ml-auto">
                    {v?.tel ? <CpapNoticeSms name={name} tel={v.tel} setting={c?.setting ?? null} chartNo={r.chartNo} date={date} sentAt={sent} /> : <span className="text-xs text-slate-400">{c?.vendor ? "회사 연락처 모름" : "새 CPAP — 아래 의뢰 문자"}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <details open={newCpap.length > 0}>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">새 CPAP 처방 — 회사 의뢰 문자·OSA 시트용 복사{newCpap.length > 0 ? ` (${newCpap.length}명)` : ""}</summary>
          <div className="mt-2">
            <CpapRxForm patients={(newCpap.length ? newCpap : rows).map((r) => ({ date, time: r.time, name: cpapOf(r.chartNo)?.realName ?? r.name, chartNo: r.chartNo, sex: r.sex ?? "", age: r.age ?? "" }))} today={date} />
          </div>
        </details>
      </section>

      <section className={box}>
        <h2 className="font-semibold">수술환자 정리 {surgery.length}명</h2>
        <p className="text-sm text-slate-500">외래 진행 중 Plan에서 수술을 고른 환자 — EMR 수술 일정이 올라오면 같은 계획에 날짜가 채워집니다(중복 안 만듦).</p>
        {surgery.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {surgery.map((r) => {
              const p = patients.find((x) => x.chartNo === r.chartNo);
              const plan = p?.opPlans[0];
              return (
                <li key={r.chartNo} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-11 text-xs text-slate-500">{r.time}</span>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-slate-500">{r.chartNo}</span>
                  <span className="text-slate-600">{r.diagnosis}</span>
                  {plan ? (
                    <Link href={`/plans/${plan.id}`} className="ml-auto text-emerald-700 underline">{plan.surgeryType.name} {safeDateStr(plan.plannedDate) ?? "날짜 미정"}</Link>
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
