import Link from "next/link";
import type { OutpatientRow } from "@/lib/hospital-link";
import type { PatientPathwayView, VisitSummaryView } from "@/lib/pathway-store";
import type { RoadmapParts, SoapParts, StageCall } from "@/lib/clinic-view";
import { toggleTodo } from "@/app/actions/roadmap";
import { sendToSurgery } from "@/app/actions/clinic-surgery";
import { RoadmapBox } from "../outpatient/roadmap-box";
import { PathwayFlow } from "./pathway-flow";
import { OrderPanel, type ClinicJobView } from "./order-panel";
import type { ClinicDefaults } from "@/lib/opd-jobs";

const PLAN_LABEL: Record<string, string> = { surgery: "수술", medication: "약물치료", observation: "경과관찰", return: "회송" };
export const VISIT_CLS: Record<string, string> = { 초진: "bg-sky-100 text-sky-800", 재초: "bg-violet-100 text-violet-800", 재진: "bg-slate-100 text-slate-600" };
const card = "rounded-lg border border-slate-200 bg-white p-4";

// 진료 화면 오른쪽 — 고른 환자 머리줄, 로드맵(도형·판정·경과·할 일), SOAP 4칸, 오늘 오더. 데이터는 page.tsx가 읽어 준다
export function ClinicDetail(p: {
  row: OutpatientRow;
  summary: string | null;
  soap: SoapParts;
  roadmap: RoadmapParts;
  roadmapVersion: { id: string; done: string[] } | null;
  care: { planType: string | null; nextVisit: string | null } | null;
  patientId: string | null;
  nextPlan: { id: string; date: string } | null;
  pathways: PatientPathwayView[];
  visits: VisitSummaryView[];
  calls: Record<string, StageCall | null>;
  templates: { id: string; title: string; audience: string }[];
  job: ClinicJobView | null;
  defaults: ClinicDefaults;
  date: string;
  canSend: boolean;
}) {
  const { row, soap, roadmap: rp, roadmapVersion: rm } = p;
  return (
    <div className="space-y-4">
      <div className={`${card} space-y-1`}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-semibold">{row.name}</span>
          <span className="text-sm text-slate-500">{row.chartNo}</span>
          <span className={`rounded px-1.5 py-0.5 text-xs ${VISIT_CLS[row.visit] ?? "bg-slate-100"}`}>{row.visit}</span>
          <span className="text-sm text-slate-700">{row.diagnosis}</span>
          {p.care?.planType && <span className="text-sm text-slate-500">Plan {PLAN_LABEL[p.care.planType] ?? p.care.planType}</span>}
          {p.care?.nextVisit && <span className="text-sm text-slate-500">다음 외래 {p.care.nextVisit}</span>}
          {p.patientId && (
            <Link href={`/patients/${p.patientId}`} className="text-sm text-emerald-700 underline">
              환자
            </Link>
          )}
          {p.nextPlan && (
            <Link href={`/plans/${p.nextPlan.id}`} className="text-sm text-emerald-700 underline">
              수술 {p.nextPlan.date}
            </Link>
          )}
          {/* 수술하기로 했으면 바로 수술환자 관리로(사용자 2026-10-27) — 없으면 만들고 Plan 수술 표시 */}
          {!p.nextPlan && (
            <form action={sendToSurgery.bind(null, p.date, row.chartNo)}>
              <button type="submit" className="rounded border border-emerald-600 px-2 py-0.5 text-sm text-emerald-700 hover:bg-emerald-50">
                수술환자 관리로
              </button>
            </form>
          )}
        </div>
        {p.summary && <p className="text-sm text-slate-700">{p.summary}</p>}
        {soap.core && <p className="rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-900">오늘: {soap.core}</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold text-slate-500">로드맵</h2>
            <PathwayFlow chartNo={row.chartNo} pathways={p.pathways} visits={p.visits} calls={p.calls} />
            {(rp.course.length > 0 || rp.now || rp.todo || rp.check) && (
              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                {rp.course.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-slate-500">경과</p>
                    <ol className="relative space-y-2 border-l-2 border-slate-200 pl-4 text-sm">
                      {rp.course.map((c, i) => (
                        <li key={i} className="relative">
                          <span aria-hidden className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-slate-400 bg-white" />
                          {c}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="space-y-3 text-sm">
                  {rp.now && (
                    <p>
                      <span className="text-xs text-slate-500">현재 </span>
                      {rp.now}
                    </p>
                  )}
                  {rp.todo && rm && <RoadmapBox text={rp.todo} done={rm.done} meta="할 일 — 눌러서 체크" toggle={toggleTodo.bind(null, rm.id)} />}
                  {rp.todo && !rm && <p className="whitespace-pre-wrap">{rp.todo}</p>}
                  {rp.check && <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">확인: {rp.check}</p>}
                </div>
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold text-slate-500">SOAP (AI 요약, 참고용)</h2>
            {soap.S || soap.O || soap.A || soap.P ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(["S", "O", "A", "P"] as const).map((k) => (
                  <div key={k} className="flex gap-3 rounded-md border border-slate-200 p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">{k}</span>
                    <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-slate-700">{soap[k] || <span className="text-slate-300">-</span>}</p>
                  </div>
                ))}
                {soap.other && <p className="whitespace-pre-wrap text-sm text-slate-500 sm:col-span-2">{soap.other}</p>}
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-400">{soap.other || "SOAP 없음"}</p>
            )}
          </section>
        </div>

        {/* 폰·좁은 화면에서는 오더를 맨 위로(스크롤 없이 보내기) */}
        <aside className="order-first xl:sticky xl:top-4 xl:order-none xl:self-start">
          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold text-slate-500">오늘 오더</h2>
            <OrderPanel key={row.chartNo} chartNo={row.chartNo} name={row.name} visit={row.visit} visitDate={p.date} canSend={p.canSend} templates={p.templates} job={p.job} defaults={p.defaults} />
          </section>
        </aside>
      </div>
    </div>
  );
}
