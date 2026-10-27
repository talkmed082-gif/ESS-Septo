"use client";

import { useTransition } from "react";
import Link from "next/link";
import { deleteReminderFromList, setReminderDone } from "@/app/actions/reminders";

export type ReminderItem = { id: string; title: string; due: string | null; late: boolean; content: string | null; authorName: string | null; done: boolean; deletable: boolean; patient: { id: string; name: string; chartNo: string | null } };

// 일정 알림 줄 — 체크하면 완료(다시 누르면 되돌림), 사이트에서 만든 것은 삭제도(사용자 2026-10-27)
function Row({ r }: { r: ReminderItem }) {
  const [pending, start] = useTransition();
  return (
    <li className={`rounded-md border border-slate-200 bg-white p-3 text-sm ${r.done ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <input type="checkbox" aria-label={`${r.title} 완료`} checked={r.done} disabled={pending} onChange={(e) => start(() => setReminderDone(r.id, e.target.checked))} />
        <span className={`font-mono text-xs ${r.late && !r.done ? "text-red-600" : "text-slate-500"}`}>{r.due ?? "기한 없음"}</span>
        <span className={`font-medium text-slate-900 ${r.done ? "line-through" : ""}`}>{r.title}</span>
        <Link href={`/patients/${r.patient.id}#reminders`} className="text-emerald-700 underline">
          {r.patient.name}
          {r.patient.chartNo && ` ${r.patient.chartNo}`}
        </Link>
        {r.authorName && <span className="text-xs text-slate-400">{r.authorName}</span>}
        {r.deletable && (
          <button type="button" disabled={pending} className="ml-auto text-xs text-red-600 underline" onClick={() => start(() => deleteReminderFromList(r.id))}>
            삭제
          </button>
        )}
      </div>
      {r.content && <p className="mt-1 whitespace-pre-wrap text-slate-600">{r.content}</p>}
    </li>
  );
}

export function ReminderList({ items }: { items: ReminderItem[] }) {
  const open = items.filter((r) => !r.done), done = items.filter((r) => r.done);
  return (
    <div className="space-y-2">
      {open.length === 0 ? <p className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-400">남은 알림이 없습니다.</p> : <ul className="space-y-2">{open.map((r) => <Row key={r.id} r={r} />)}</ul>}
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-slate-500">완료 {done.length}건</summary>
          <ul className="mt-2 space-y-2">{done.map((r) => <Row key={r.id} r={r} />)}</ul>
        </details>
      )}
    </div>
  );
}
