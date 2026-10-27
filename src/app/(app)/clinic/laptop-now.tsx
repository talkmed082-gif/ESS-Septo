"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type LaptopNowView = {
  running: { time: string; name: string; visit: string; visitDate: string; step: string; updatedAt: string } | null;
  counts: { pending: number; waiting: number; done: number; failed: number };
  date: string;
};

// [노트북 지금](사용자 2026-10-27 "노트북이 뭘 하고 있는지, 누구의 기록지를 어떻게") — 처리 중인 환자와 단계(작업자가 단계마다 보고), 고른 날짜 일감 건수.
// 처리 중이거나 대기가 있으면 5초마다 새로 읽는다
export function LaptopNow({ view }: { view: LaptopNowView }) {
  const router = useRouter();
  const { running, counts } = view;
  const busy = !!running || counts.pending > 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => { router.refresh(); setNow(Date.now()); }, 5000);
    return () => clearInterval(t);
  }, [busy, router]);
  const sec = running ? Math.max(0, Math.round((now - Date.parse(running.updatedAt)) / 1000)) : 0;
  const total = counts.pending + counts.waiting + counts.done + counts.failed;

  return (
    <div className={`rounded-lg border p-3 text-sm ${running ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-medium text-slate-500">노트북 지금</p>
      {running ? (
        <div className="mt-1 space-y-0.5">
          <p className="font-medium">
            {running.time} {running.name} <span className="text-xs text-slate-500">{running.visit}</span>
            {running.visitDate !== view.date && <span className="ml-1 text-xs text-slate-500">({running.visitDate})</span>}
          </p>
          <p className="text-sky-800">{running.step || "처리 시작"}</p>
          <p className="text-[11px] text-slate-500">{sec < 60 ? `${sec}초째` : `${Math.floor(sec / 60)}분째`}</p>
        </div>
      ) : (
        <p className="mt-1 text-slate-500">{counts.pending > 0 ? "곧 다음 환자를 시작합니다" : "쉬는 중"}</p>
      )}
      {total > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          {view.date} · 대기 {counts.pending} · 나중에 다시 {counts.waiting} · 완료 {counts.done}
          {counts.failed > 0 && <span className="text-red-700"> · 멈춤 {counts.failed}</span>}
        </p>
      )}
    </div>
  );
}
