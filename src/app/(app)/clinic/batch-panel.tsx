"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/lib/ui";
import { saveClinicDefaults, sendBatchToLaptop } from "@/app/actions/clinic";
import { clinicDefaults, type ClinicDefaults } from "@/lib/opd-jobs";

type Row = { time: string; name: string; chartNo: string; visit: string; diagnosis: string; sent: boolean };
type Tpl = { id: string; title: string; audience: string };
type Pick = { on: boolean; scope: boolean; templateId: string };

// 하루치를 노트북으로 한 번에(사용자 2026-10-25) — 목록에서 확인하고 보낸다.
// 순서(사용자 2026-10-27 "어떻게 보낼지 설정하고 보내야지"): ① 할 일(모든 환자 공통, 저장한 기본값으로 시작) → ② 환자 → ③ 요약 보고 [보내기 확인].
// 초진은 명단 주진단이 비어 있는 경우가 많아 템플릿을 자동으로 못 고름 → 초진·재초는 여기서 고르고,
// 진단 확인은 재진이거나 템플릿을 고른 환자만(템플릿 없이 돌리면 기본 J34.2가 엉뚱한 환자에 붙을 수 있음).
// 비인강경은 기본 끔(사용자 2026-10-27), 켜면 환자마다 뺄 수 있다. 이미 보낸 환자는 처음엔 빠져 있음
export function BatchPanel({ date, rows, templates, defaults = clinicDefaults(null) }: { date: string; rows: Row[]; templates: Tpl[]; defaults?: ClinicDefaults }) {
  const router = useRouter();
  const [note, setNote] = useState(defaults.note);
  const [dx, setDx] = useState(defaults.dx);
  const [scope, setScope] = useState(defaults.scope);
  const [practice, setPractice] = useState(false);
  const [picks, setPicks] = useState<Record<string, Pick>>(() => Object.fromEntries(rows.map((r) => [r.chartNo, { on: !r.sent, scope: true, templateId: "" }])));
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (c: string, p: Partial<Pick>) => {
    setConfirming(false);
    setPicks((s) => ({ ...s, [c]: { ...s[c], ...p } }));
  };
  const all = (on: boolean) => {
    setConfirming(false);
    setPicks((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, on }])));
  };
  const chosen = rows.filter((r) => picks[r.chartNo]?.on);
  const items = chosen.map((row) => {
    const p = picks[row.chartNo];
    const follow = row.visit === "재진";
    return { chartNo: row.chartNo, name: row.name, visit: row.visit, templateId: p.templateId || null, tasks: { note, dx: dx && (follow || !!p.templateId), scope: scope && p.scope, where: "laptop" as const } };
  });
  const nothing = !note && !dx && !scope;
  const count = (k: "dx" | "scope") => items.filter((i) => i.tasks[k]).length;
  const summary = [note && "기록지", dx && `진단 확인 ${count("dx")}명`, scope && `비인강경 ${count("scope")}명`].filter(Boolean).join(" · ");

  const send = () =>
    start(async () => {
      setMsg(null);
      const r = await sendBatchToLaptop({ visitDate: date, practice, items });
      setConfirming(false);
      setMsg(r.ok ? `${r.count}명 보냄 — 노트북이 07:30부터(이미 지났으면 바로) 처리합니다` : (r.error ?? "보내지 못했습니다."));
      router.refresh();
    });
  const toggle = (fn: (v: boolean) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirming(false);
    fn(e.target.checked);
  };

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">하루치 노트북으로 — 설정하고 보내기</summary>
      <div className="space-y-3 border-t border-slate-100 p-2 text-sm">
        <section className="space-y-1">
          <p className="text-xs font-medium text-slate-500">① 할 일(모든 환자 공통)</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={note} onChange={toggle(setNote)} />
            기록지(재진: 이전 기록 S·O·A + Plan은 로드맵 할 일, 초진: 템플릿)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={dx} onChange={toggle(setDx)} />
            진단 확인(재진·템플릿 고른 초진만)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scope} onChange={toggle(setScope)} />
            비인강경 오더 + 처방 서명
          </label>
          <label className="flex items-center gap-2 text-slate-500">
            <input type="checkbox" checked={practice} onChange={toggle(setPractice)} />
            연습(EMR에 쓰지 않고 할 일만 확인)
          </label>
          <button
            type="button"
            className={buttonStyles.secondarySmall}
            disabled={pending}
            onClick={() => start(async () => { const r = await saveClinicDefaults({ where: defaults.where, note, dx, scope }); setMsg(r.ok ? "이 설정을 기본으로 저장했습니다" : (r.error ?? "저장하지 못했습니다.")); })}
          >
            이 설정 저장
          </button>
        </section>

        <section className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-slate-500">② 환자 {chosen.length}/{rows.length}명</span>
            <button type="button" className="underline" onClick={() => all(true)}>
              모두
            </button>
            <button type="button" className="underline" onClick={() => all(false)}>
              모두 빼기
            </button>
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {rows.map((r) => {
              const p = picks[r.chartNo];
              const first = r.visit !== "재진";
              return (
                <li key={r.chartNo} className={`space-y-1 py-1.5 ${p.on ? "" : "opacity-50"}`}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={p.on} onChange={(e) => set(r.chartNo, { on: e.target.checked })} />
                    <span className="w-10 text-xs text-slate-500">{r.time}</span>
                    <span className="flex-1 truncate">
                      {r.name} <span className="text-xs text-slate-500">{r.visit}</span>
                      {r.sent && <span className="ml-1 text-xs text-sky-700">보냄</span>}
                    </span>
                    {scope && (
                      <span className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={p.scope} onChange={(e) => set(r.chartNo, { scope: e.target.checked })} />
                        비인강경
                      </span>
                    )}
                  </label>
                  {p.on && first && note && (
                    <select value={p.templateId} onChange={(e) => set(r.chartNo, { templateId: e.target.value })} className="ml-6 w-[calc(100%-1.5rem)] rounded border border-slate-300 bg-white px-1 py-1 text-xs" aria-label={`${r.name} 템플릿`}>
                      <option value="">템플릿 없음(통증 “없음”만, 진단 확인 안 함)</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.audience === "child" ? "[소아] " : ""}
                          {t.title}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ③ 한 번 누르면 요약만 보여 주고, [보내기 확인]을 눌러야 노트북에 들어간다(사용자 2026-10-27 "누르자마자 바로 일을 시키면 안 됨") */}
        {!confirming ? (
          <button type="button" className={buttonStyles.accent} disabled={pending || chosen.length === 0 || nothing} onClick={() => { setMsg(null); setConfirming(true); }}>
            ③ {chosen.length}명 보내기…
          </button>
        ) : (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2">
            <p>
              노트북으로 <b>{chosen.length}명</b> — {summary}
              {practice ? " (연습)" : ""}
            </p>
            <div className="flex gap-2">
              <button type="button" className={buttonStyles.accent} disabled={pending} onClick={send}>
                보내기 확인
              </button>
              <button type="button" className={buttonStyles.secondarySmall} disabled={pending} onClick={() => setConfirming(false)}>
                고치기
              </button>
            </div>
          </div>
        )}
        {msg && <p className="text-xs">{msg}</p>}
      </div>
    </details>
  );
}
