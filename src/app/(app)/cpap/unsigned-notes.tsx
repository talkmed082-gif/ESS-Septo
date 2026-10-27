"use client";

import { useTransition } from "react";
import { setNoteState } from "@/app/actions/clinic-plan";

export type UnsignedNote = { id: string; time: string; name: string; chartNo: string; savedAt: string; opened: boolean; state: string | null };

// 외래 후 — 노트북이 저장(서명 전)한 기록지(사용자 2026-10-27). 서명하거나 EMR에서 직접 지운 뒤 표시하면 목록에서 빠진다.
// 진료실 PC에서 그 환자 기록지를 연 기록이 없으면 "안 온 환자일 수 있음". 지우기는 EMR에서 직접(되돌릴 수 없는 삭제라 자동화하지 않음)
export function UnsignedNotes({ notes }: { notes: UnsignedNote[] }) {
  const [pending, start] = useTransition();
  const open = notes.filter((n) => !n.state), done = notes.filter((n) => n.state);
  const btn = "rounded border px-2 py-0.5 text-xs disabled:opacity-50";
  return (
    <div className="space-y-2 text-sm">
      {open.length === 0 ? <p className="text-slate-400">서명할 기록지가 없습니다.</p> : (
        <ul className="divide-y divide-slate-100">
          {open.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="w-12 text-xs text-slate-500">{n.time}</span>
              <span className="font-medium">{n.name}</span>
              <span className="text-xs text-slate-500">{n.chartNo} · {n.savedAt} 저장</span>
              {!n.opened && <span className="rounded bg-amber-100 px-1 text-xs text-amber-800">진료실에서 안 열림 — 안 온 환자일 수 있음(EMR에서 직접 삭제)</span>}
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
                {n.time} {n.name} — {n.state === "signed" ? "서명함" : "EMR에서 지움"}{" "}
                <button type="button" className="underline" disabled={pending} onClick={() => start(() => setNoteState(n.id, null))}>되돌리기</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
