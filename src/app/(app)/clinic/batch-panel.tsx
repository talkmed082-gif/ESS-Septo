"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/lib/ui";
import { sendBatchToLaptop } from "@/app/actions/clinic";

type Row = { time: string; name: string; chartNo: string; visit: string; diagnosis: string; sent: boolean };
type Tpl = { id: string; title: string; audience: string };
type Pick = { on: boolean; scope: boolean; templateId: string };

// 하루치를 노트북으로 한 번에(사용자 2026-10-25) — 목록에서 확인하고 보낸다.
// 초진은 명단 주진단이 비어 있는 경우가 많아 템플릿을 자동으로 못 고름 → 초진·재초는 여기서 고르고,
// 진단 확인은 재진이거나 템플릿을 고른 환자만(템플릿 없이 돌리면 기본 J34.2가 엉뚱한 환자에 붙을 수 있음).
// 비인강경은 환자마다 끌 수 있다(귀 환자 등). 이미 보낸 환자는 처음엔 빠져 있음
export function BatchPanel({ date, rows, templates }: { date: string; rows: Row[]; templates: Tpl[] }) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<string, Pick>>(() => Object.fromEntries(rows.map((r) => [r.chartNo, { on: !r.sent, scope: true, templateId: "" }])));
  const [practice, setPractice] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (c: string, p: Partial<Pick>) => setPicks((s) => ({ ...s, [c]: { ...s[c], ...p } }));
  const chosen = rows.filter((r) => picks[r.chartNo]?.on);

  const send = () =>
    start(async () => {
      setMsg(null);
      const r = await sendBatchToLaptop({
        visitDate: date,
        practice,
        items: chosen.map((row) => {
          const p = picks[row.chartNo];
          const follow = row.visit === "재진";
          return { chartNo: row.chartNo, name: row.name, visit: row.visit, templateId: p.templateId || null, tasks: { note: true, dx: follow || !!p.templateId, scope: p.scope, where: "laptop" as const } };
        }),
      });
      setMsg(r.ok ? `${r.count}명 보냄 — 노트북이 07:30부터(이미 지났으면 바로) 처리합니다` : (r.error ?? "보내지 못했습니다."));
      router.refresh();
    });

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">하루치 노트북으로 보내기</summary>
      <div className="space-y-2 border-t border-slate-100 p-2 text-sm">
        <div className="flex gap-2 text-xs">
          <button type="button" className="underline" onClick={() => setPicks((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, on: true }])))}>
            모두
          </button>
          <button type="button" className="underline" onClick={() => setPicks((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, on: false }])))}>
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
                  <span className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={p.scope} onChange={(e) => set(r.chartNo, { scope: e.target.checked })} />
                    비인강경
                  </span>
                </label>
                {p.on && first && (
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
        <p className="text-xs text-slate-500">재진: 이전 이비인후과 기록(S·O·A) + Plan은 로드맵 할 일 · 진단 확인 · 저장 + 처방 서명</p>
        <label className="flex items-center gap-2 text-slate-500">
          <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} />
          연습(EMR에 쓰지 않고 할 일만 확인)
        </label>
        <button type="button" className={buttonStyles.accent} disabled={pending || chosen.length === 0} onClick={send}>
          {chosen.length}명 노트북으로 보내기
        </button>
        {msg && <p className="text-xs">{msg}</p>}
      </div>
    </details>
  );
}
