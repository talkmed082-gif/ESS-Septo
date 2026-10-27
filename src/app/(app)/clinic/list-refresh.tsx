"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOutpatientRefresh } from "@/app/actions/clinic";

// 명단 [새로고침](사용자 2026-10-27 "현 상황 업데이트") — 일감 상태는 바로 다시 읽고, 오늘·앞날이면 노트북에 EMR 명단 다시 읽기를 요청한다
// (새로 잡힌 환자만 더함 — 진료 마친 환자는 EMR 명단에서 빠지므로). 요청 중이면 10초마다 다시 읽어 반영되면 보인다
export function ListRefresh({ date, canEmr, updatedAt, requested }: { date: string; canEmr: boolean; updatedAt: string | null; requested: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!requested) return;
    const t = setInterval(() => router.refresh(), 10_000);
    const stop = setTimeout(() => clearInterval(t), 5 * 60_000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [requested, router]);
  const at = updatedAt ? new Date(updatedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <button
        type="button"
        disabled={pending}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        onClick={() =>
          start(async () => {
            setMsg(null);
            if (canEmr) {
              const r = await requestOutpatientRefresh(date);
              setMsg(r.ok ? "노트북에 EMR 명단 다시 읽기를 요청했습니다(1~2분)" : (r.error ?? "요청하지 못했습니다."));
            }
            router.refresh();
          })
        }
      >
        ↻ 새로고침
      </button>
      {at && <span>명단 {at} 갱신</span>}
      {requested && !msg && <span className="text-sky-700">노트북에 요청함 — 기다리는 중</span>}
      {msg && <span>{msg}</span>}
    </div>
  );
}
