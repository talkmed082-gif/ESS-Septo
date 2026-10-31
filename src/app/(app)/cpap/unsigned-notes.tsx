"use client";

import { useState, useTransition } from "react";
import { approveNoteDeletes, requestNoteCheck, setNoteState } from "@/app/actions/clinic-plan";
import { canRequestCheck, isNoteDone, parseNoteState } from "@/lib/note-cleanup";

export type UnsignedNote = { id: string; time: string; name: string; chartNo: string; savedAt: string; opened: boolean; state: string | null };

// 외래 후 — 노트북이 저장(서명 전)한 기록지(사용자 2026-10-27).
// [EMR에서 확인] → 노트북이 서명됨·안 온 환자 후보(서명 안 됨·그날 오더 없음·쓴 뒤 고친 적 없음)·직접 확인으로 나눈다.
// 후보는 골라서 [삭제 승인]한 것만 노트북이 EMR에서 지운다(되돌릴 수 없음, 사유 "미내원(내원 전 미리 작성)"). 직접 처리 버튼도 그대로
export function UnsignedNotes({ notes, date }: { notes: UnsignedNote[]; date: string }) {
  const [pending, start] = useTransition();
  const rows = notes.map((n) => ({ ...n, s: parseNoteState(n.state) }));
  const open = rows.filter((n) => !isNoteDone(n.s)), done = rows.filter((n) => isNoteDone(n.s));
  const candidates = open.filter((n) => n.s.kind === "noShow");
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const chosen = picked ?? new Set(candidates.map((n) => n.id));
  const checkable = open.some((n) => canRequestCheck(n.state));
  const waiting = open.some((n) => n.s.kind === "check" || n.s.kind === "deleteRequested");
  const btn = "rounded border px-2 py-0.5 text-xs disabled:opacity-50";

  const approve = () => {
    const ids = candidates.filter((n) => chosen.has(n.id)).map((n) => n.id);
    if (!ids.length) return;
    if (!window.confirm(`EMR에서 기록지 ${ids.length}건을 지웁니다(되돌릴 수 없음, 사유: 미내원). 노트북이 지우기 직전에 조건을 다시 확인합니다. 진행할까요?`)) return;
    start(async () => { await approveNoteDeletes(ids); setPicked(null); });
  };

  const badge = (n: (typeof rows)[number]) => {
    switch (n.s.kind) {
      case "check": return <span className="rounded bg-slate-100 px-1 text-xs text-slate-600">노트북 확인 대기(매일 8~20시 10분마다)</span>;
      case "keep": return <span className="rounded bg-amber-100 px-1 text-xs text-amber-800">직접 확인 — {n.s.reason}</span>;
      case "deleteRequested": return <span className="rounded bg-slate-100 px-1 text-xs text-slate-600">삭제 승인됨 — 노트북 대기(그날 외래는 18시 뒤, 평일 20시까지)</span>;
      case "deleteFailed": return <span className="rounded bg-red-100 px-1 text-xs text-red-800">지우지 못함 — {n.s.reason}</span>;
      case "noShow": return null;
      default: return !n.opened ? <span className="rounded bg-amber-100 px-1 text-xs text-amber-800">진료실에서 안 열림 — 안 온 환자일 수 있음</span> : null;
    }
  };

  return (
    <div className="space-y-3 text-sm">
      {(checkable || waiting) && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || !checkable} className={`${btn} border-sky-600 text-sky-700`} onClick={() => start(() => requestNoteCheck(date))}>EMR에서 확인</button>
          <span className="text-xs text-slate-500">서명 여부·그날 오더·고친 적 있는지 노트북이 읽어 안 온 환자 후보를 고릅니다</span>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="space-y-2 rounded border border-red-200 bg-red-50 p-3">
          <p className="font-medium text-red-900">안 온 환자 후보 {candidates.length}건 — 서명 안 됨 · 그날 오더 없음 · 쓴 뒤 고친 적 없음</p>
          <ul className="space-y-1">
            {candidates.map((n) => (
              <li key={n.id}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={chosen.has(n.id)} onChange={(e) => { const s = new Set(chosen); if (e.target.checked) s.add(n.id); else s.delete(n.id); setPicked(s); }} />
                  <span className="w-12 text-xs text-slate-500">{n.time}</span>
                  <span className="font-medium">{n.name}</span>
                  <span className="text-xs text-slate-500">{n.chartNo} · 기록지 {n.s.kind === "noShow" ? n.s.noteId : ""}</span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" disabled={pending || chosen.size === 0} className="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50" onClick={approve}>
            삭제 승인 ({candidates.filter((n) => chosen.has(n.id)).length}건)
          </button>
        </div>
      )}

      {open.filter((n) => n.s.kind !== "noShow").length === 0 ? (candidates.length === 0 && <p className="text-slate-400">서명할 기록지가 없습니다.</p>) : (
        <ul className="divide-y divide-slate-100">
          {open.filter((n) => n.s.kind !== "noShow").map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="w-12 text-xs text-slate-500">{n.time}</span>
              <span className="font-medium">{n.name}</span>
              <span className="text-xs text-slate-500">{n.chartNo} · {n.savedAt} 저장</span>
              {badge(n)}
              <span className="ml-auto flex gap-1">
                <button type="button" disabled={pending} className={`${btn} border-emerald-600 text-emerald-700`} onClick={() => start(() => setNoteState(n.id, "signed"))}>서명함</button>
                <button type="button" disabled={pending} className={`${btn} border-slate-300 text-slate-600`} onClick={() => start(() => setNoteState(n.id, "deleted"))}>EMR에서 지움</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-slate-500">처리함 {done.length}건</summary>
          <ul className="mt-1 space-y-1 text-xs text-slate-500">
            {done.map((n) => (
              <li key={n.id}>
                {n.time} {n.name} — {n.s.kind === "signed" ? "서명함" : "EMR에서 지움"}{" "}
                <button type="button" className="underline" disabled={pending} onClick={() => start(() => setNoteState(n.id, null))}>되돌리기</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
