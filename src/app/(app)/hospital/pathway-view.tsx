"use client";

import { useState, useTransition } from "react";
import { PATHWAYS, pathwayById, stageOf, type Stage } from "@/lib/pathways";
import type { PatientPathwayView, VisitSummaryView } from "@/lib/pathway-store";
import { removePathway, setStage } from "@/app/actions/pathway";

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 진료 경로 — 외래 버튼(누르면 그 외래 요약), 단계 버튼(지난 단계 ✓ · 지금 ● · 앞으로), 지금 단계의 할 일과 갈림길
export function PathwayView({ chartNo, pathways, visits }: { chartNo: string; pathways: PatientPathwayView[]; visits: VisitSummaryView[] }) {
  const [openVisit, setOpenVisit] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<void>) => start(fn);
  const visit = visits.find((v) => v.visitDate === openVisit);
  const firstDate = visits[0]?.visitDate;

  return (
    <div className="mt-1 space-y-3 rounded bg-slate-50 p-3 text-slate-700">
      {visits.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">외래</p>
          <div className="flex flex-wrap gap-1.5">
            {visits.map((v) => (
              <button
                key={v.visitDate}
                type="button"
                onClick={() => setOpenVisit(openVisit === v.visitDate ? null : v.visitDate)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${openVisit === v.visitDate ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white hover:border-emerald-500"}`}
              >
                {md(v.visitDate)}
                {v.visitDate === firstDate ? " 초진" : ""}
              </button>
            ))}
          </div>
          {visit && (
            <div className="rounded border border-slate-200 bg-white p-2 text-sm">
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

      {pathways.map((pp) => {
        const def = pathwayById(pp.pathwayId);
        if (!def) return null;
        const cur = stageOf(def, pp.stageId);
        const passed = new Set(pp.history.map((h) => h.stageId).filter((s) => s !== pp.stageId));
        const proposed = stageOf(def, pp.proposedStageId);
        return (
          <div key={pp.pathwayId} className={`space-y-2 ${pending ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{def.name}</span>
              <span className="text-xs text-slate-400">시작 {pp.startedAt} · 최장 관찰 {def.maxFollow}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${pp.confirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {pp.confirmed ? "확정" : "AI 제안"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {def.stages.map((s, i) => (
                <span key={s.id} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-slate-300">→</span>}
                  <span
                    className={`rounded-full border px-2 py-0.5 ${
                      s.id === pp.stageId
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : passed.has(s.id)
                          ? "border-slate-200 bg-slate-100 text-slate-400"
                          : "border-slate-300 bg-white"
                    }`}
                  >
                    {passed.has(s.id) ? "✓ " : s.id === pp.stageId ? "● " : ""}
                    {s.name}
                  </span>
                </span>
              ))}
            </div>
            {cur && <CurrentStage stage={cur} onPick={(to) => act(() => setStage(chartNo, def.id, to))} />}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {proposed && (
                <span className="inline-flex flex-wrap items-center gap-2 rounded bg-amber-50 px-2 py-1 text-amber-800">
                  AI 제안: {proposed.name}
                  {pp.proposedReason ? ` — ${pp.proposedReason}` : ""}
                  <button type="button" className="rounded border border-amber-400 bg-white px-2" onClick={() => act(() => setStage(chartNo, def.id, proposed.id))}>
                    받기
                  </button>
                </span>
              )}
              {!pp.confirmed && (
                <button type="button" className="rounded border border-emerald-500 bg-white px-2 py-0.5 text-emerald-700" onClick={() => act(() => setStage(chartNo, def.id, pp.stageId))}>
                  이 단계 확정
                </button>
              )}
              <select
                aria-label="단계 바꾸기"
                className="rounded border border-slate-300 bg-white px-1 py-0.5"
                value=""
                onChange={(e) => e.target.value && act(() => setStage(chartNo, def.id, e.target.value))}
              >
                <option value="">단계 바꾸기…</option>
                {def.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => confirm(`${def.name} 경로를 뺄까요?`) && act(() => removePathway(chartNo, def.id))}>
                경로 빼기
              </button>
            </div>
          </div>
        );
      })}

      {pathways.length < 2 && (
        <select
          aria-label="경로 추가"
          className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
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
    </div>
  );
}

function CurrentStage({ stage, onPick }: { stage: Stage; onPick: (to: string) => void }) {
  return (
    <div className="rounded border border-emerald-200 bg-white p-2 text-sm">
      <p>
        <span className="font-medium">지금: {stage.name}</span>
        {stage.when && <span className="text-slate-500"> ({stage.when})</span>}
        {stage.next && <span className="text-slate-500"> · 다음 외래 권장 {stage.next}</span>}
      </p>
      {stage.todo.length > 0 && <p className="text-slate-600">할 일: {stage.todo.join(" · ")}</p>}
      {stage.decide && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-amber-700">◆ {stage.decide.q}</span>
          {stage.decide.options.map((o) =>
            o.to ? (
              <button key={o.label} type="button" onClick={() => onPick(o.to!)} className="rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100">
                {o.label}
              </button>
            ) : (
              <span key={o.label} className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500" title={o.note}>
                {o.label} {o.note}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}
