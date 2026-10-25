"use client";

import { Fragment, useState, useTransition } from "react";
import { PATHWAYS, pathwayById, stageOf } from "@/lib/pathways";
import type { PatientPathwayView, VisitSummaryView } from "@/lib/pathway-store";
import type { StageCall } from "@/lib/clinic-view";
import { removePathway, setStage } from "@/app/actions/pathway";

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const SOURCE_LABEL: Record<StageCall["source"], string> = { surgery: "수술 기록", plan: "수술 예정", doctor: "의사 확정", ai: "AI" };

function Arrow() {
  return (
    <svg aria-hidden width="18" height="12" viewBox="0 0 18 12" className="shrink-0 text-slate-300">
      <path d="M0 6h14M10 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// 진료 경로를 도형으로 — 단계는 둥근 상자(지난 ✓ 회색 · 지금 초록 · 판정이 다르면 점선 주황), 갈림길은 마름모.
// 아래에 지금 단계 판정(근거)과 할 일·갈림길 버튼. 외래는 시간 줄의 점(누르면 그 외래 요약)
export function PathwayFlow({
  chartNo,
  pathways,
  visits,
  calls,
}: {
  chartNo: string;
  pathways: PatientPathwayView[];
  visits: VisitSummaryView[];
  calls: Record<string, StageCall | null>;
}) {
  const [openVisit, setOpenVisit] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<void>) => start(fn);
  const visit = visits.find((v) => v.visitDate === openVisit);

  return (
    <div className={`space-y-4 ${pending ? "opacity-60" : ""}`}>
      {pathways.map((pp) => {
        const def = pathwayById(pp.pathwayId);
        if (!def) return null;
        const passed = new Set(pp.history.map((h) => h.stageId).filter((s) => s !== pp.stageId));
        const call = calls[pp.pathwayId];
        const callStage = call ? stageOf(def, call.stageId) : undefined;
        const cur = stageOf(def, pp.stageId);
        const differs = !!callStage && callStage.id !== pp.stageId;
        return (
          <div key={pp.pathwayId} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{def.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${pp.confirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {pp.confirmed ? "확정" : "AI 제안"}
              </span>
              <span className="text-xs text-slate-400">시작 {pp.startedAt} · 최장 관찰 {def.maxFollow}</span>
            </div>

            <div className="flex flex-wrap items-center gap-y-2">
              {def.stages.map((s, i) => {
                const isCur = s.id === pp.stageId;
                const isCall = differs && s.id === callStage?.id;
                const cls = isCur
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : isCall
                    ? "border-2 border-dashed border-amber-500 bg-amber-50 text-amber-900"
                    : passed.has(s.id)
                      ? "border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-300 bg-white text-slate-700 hover:border-emerald-500";
                return (
                  <Fragment key={s.id}>
                    {i > 0 && <Arrow />}
                    <button
                      type="button"
                      title={s.when ? `${s.name} (${s.when})` : s.name}
                      onClick={() => !isCur && confirm(`지금 단계를 "${s.name}"(으)로 바꿀까요?`) && act(() => setStage(chartNo, def.id, s.id))}
                      className={`relative min-w-[4.5rem] rounded-lg border px-2.5 py-1.5 text-left text-xs leading-tight ${cls}`}
                    >
                      {isCall && <span className="absolute -top-2 right-1 rounded bg-amber-500 px-1 text-[10px] text-white">판정</span>}
                      <span className="block font-medium">
                        {passed.has(s.id) && !isCur ? "✓ " : ""}
                        {s.name}
                      </span>
                      {s.when && <span className={`block text-[10px] ${isCur ? "text-emerald-100" : "text-slate-400"}`}>{s.when}</span>}
                    </button>
                    {s.decide && (
                      <>
                        <Arrow />
                        <span title={s.decide.q} className="flex h-7 w-7 shrink-0 rotate-45 items-center justify-center border border-amber-400 bg-amber-50">
                          <span className="-rotate-45 text-[11px] font-semibold text-amber-700">?</span>
                        </span>
                      </>
                    )}
                  </Fragment>
                );
              })}
            </div>

            {call && callStage && (
              <div className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${differs ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <span className="font-medium">판정: {callStage.name}</span>
                <span className="text-slate-600">
                  근거({SOURCE_LABEL[call.source]}) {call.reason}
                </span>
                {differs ? (
                  <button type="button" className="rounded border border-amber-500 bg-white px-2 py-0.5 text-xs text-amber-800" onClick={() => act(() => setStage(chartNo, def.id, callStage.id))}>
                    이 단계로 확정
                  </button>
                ) : (
                  !pp.confirmed && (
                    <button type="button" className="rounded border border-emerald-500 bg-white px-2 py-0.5 text-xs text-emerald-700" onClick={() => act(() => setStage(chartNo, def.id, pp.stageId))}>
                      확정
                    </button>
                  )
                )}
              </div>
            )}

            {cur && (
              <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                <p>
                  <span className="font-medium">지금: {cur.name}</span>
                  {cur.next && <span className="text-slate-500"> · 다음 외래 권장 {cur.next}</span>}
                </p>
                {cur.todo.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {cur.todo.map((t) => (
                      <li key={t} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                {cur.decide && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <span aria-hidden className="inline-block h-2.5 w-2.5 rotate-45 border border-amber-500 bg-amber-100" />
                      {cur.decide.q}
                    </span>
                    {cur.decide.options.map((o) =>
                      o.to ? (
                        <button key={o.label} type="button" onClick={() => act(() => setStage(chartNo, def.id, o.to!))} className="rounded-full border border-amber-400 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 hover:bg-amber-100">
                          {o.label}
                        </button>
                      ) : (
                        <span key={o.label} className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                          {o.label} {o.note}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" className="text-xs text-slate-400 hover:text-red-600" onClick={() => confirm(`${def.name} 경로를 뺄까요?`) && act(() => removePathway(chartNo, def.id))}>
                경로 빼기
              </button>
            </div>
          </div>
        );
      })}

      {pathways.length < 2 && (
        <select
          aria-label="경로 추가"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          value=""
          onChange={(e) => {
            const p = pathwayById(e.target.value);
            if (p) act(() => setStage(chartNo, p.id, p.stages[0].id));
          }}
        >
          <option value="">{pathways.length ? "경로 하나 더…" : "진료 경로 정하기…"}</option>
          {PATHWAYS.filter((p) => !pathways.some((x) => x.pathwayId === p.id)).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {visits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">외래 기록</p>
          <div className="relative flex flex-wrap gap-x-1 gap-y-3 pb-1">
            {visits.map((v, i) => (
              <Fragment key={v.visitDate}>
                {i > 0 && <span aria-hidden className="mt-[7px] h-px w-4 bg-slate-300" />}
                <button type="button" onClick={() => setOpenVisit(openVisit === v.visitDate ? null : v.visitDate)} className="flex flex-col items-center gap-0.5 text-[11px] text-slate-600">
                  <span className={`h-3.5 w-3.5 rounded-full border-2 ${openVisit === v.visitDate ? "border-emerald-600 bg-emerald-600" : "border-emerald-500 bg-white"}`} />
                  {md(v.visitDate)}
                  {i === 0 ? " 초진" : ""}
                </button>
              </Fragment>
            ))}
          </div>
          {visit && (
            <div className="rounded-md border border-slate-200 bg-white p-2 text-sm">
              <p className="whitespace-pre-wrap break-words">{visit.summary}</p>
              {visit.pathwayId && visit.stageId && (
                <p className="pt-1 text-xs text-slate-400">
                  그때 단계: {pathwayById(visit.pathwayId)?.name} · {stageOf(pathwayById(visit.pathwayId)!, visit.stageId)?.name}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
