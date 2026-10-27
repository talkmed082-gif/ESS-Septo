"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/lib/ui";
import { saveClinicDefaults, sendBatchToLaptop } from "@/app/actions/clinic";
import type { ClinicDefaults } from "@/lib/opd-jobs";

type Row = { time: string; name: string; chartNo: string; visit: string; diagnosis: string; job: string | null };
type Tpl = { id: string; title: string; audience: string };

const VISIT_CLS: Record<string, string> = { 초진: "bg-sky-100 text-sky-800", 재초: "bg-violet-100 text-violet-800", 재진: "bg-slate-100 text-slate-600" };
const JOB_DOT: Record<string, string> = { pending: "bg-sky-500", running: "bg-sky-500", waiting: "bg-amber-500", done: "bg-emerald-500", failed: "bg-red-500" };
const JOB_LABEL: Record<string, string> = { pending: "보냄", running: "처리 중", waiting: "다시 시도", done: "완료", failed: "멈춤", cancelled: "취소" };

// 보내기 설정(사용자 2026-10-27 "설정 따로 보내기 따로") — 지금 설정을 한 줄로, [바꾸기]로 고쳐 [저장]해야 바뀐다(계정 기본값, 환자별 칸도 같음)
export function SendSettings({ defaults }: { defaults: ClinicDefaults }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(defaults);
  const [pending, start] = useTransition();
  const summary = [defaults.note ? "기록지" : null, defaults.dx ? "진단 확인" : null, defaults.scope ? "비인강경 오더·처방 서명" : "기록지 저장(서명 전)"].filter(Boolean).join(" · ");
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">보내기 설정</span>
        <span className="min-w-0 flex-1 truncate text-xs">{summary}</span>
        <button type="button" className="text-xs underline" onClick={() => { setV(defaults); setOpen(!open); }}>{open ? "닫기" : "바꾸기"}</button>
      </div>
      {open && (
        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.note} onChange={(e) => setV({ ...v, note: e.target.checked })} />기록지(재진: 이전 기록 S·O·A + 로드맵 Plan, 초진: 템플릿·없으면 “.”)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.dx} onChange={(e) => setV({ ...v, dx: e.target.checked })} />진단 확인</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.scope} onChange={(e) => setV({ ...v, scope: e.target.checked })} />비인강경 오더 + 처방 서명 <span className="text-xs text-slate-500">(끄면 기록지 저장만, 서명 전)</span></label>
          <button
            type="button"
            className={buttonStyles.secondarySmall}
            disabled={pending}
            onClick={() => start(async () => { await saveClinicDefaults(v); setOpen(false); router.refresh(); })}
          >
            저장
          </button>
        </div>
      )}
    </div>
  );
}

// 외래 명단 + 노트북으로 보내기(사용자 2026-10-27 "명단에서 바로 고르기") — 줄마다 체크(처음엔 모두 꺼짐), 초진은 템플릿,
// 맨 아래 [N명 보내기] → 요약 → [보내기 확인]. 할 일은 위 보내기 설정(저장된 값)대로
export function ClinicList({ date, chart, rows, templates, defaults, canSend }: { date: string; chart: string | undefined; rows: Row[]; templates: Tpl[]; defaults: ClinicDefaults; canSend: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [tpl, setTpl] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chosen = rows.filter((r) => picked[r.chartNo]);
  const nothing = !defaults.note && !defaults.dx && !defaults.scope;
  const toggle = (c: string, on: boolean) => { setConfirming(false); setMsg(null); setPicked((s) => ({ ...s, [c]: on })); };

  const send = () =>
    start(async () => {
      const r = await sendBatchToLaptop({
        visitDate: date,
        practice: false,
        items: chosen.map((row) => {
          const t = tpl[row.chartNo] ?? "";
          const follow = row.visit === "재진";
          // 템플릿 없는 초진은 노트북이 "." 채우기 + 진단 확인(주진단 없으면 J34.2)
          return { chartNo: row.chartNo, name: row.name, visit: row.visit, templateId: t || null, tasks: { note: defaults.note, dx: defaults.dx && (follow || !!t || defaults.note), scope: defaults.scope, where: "laptop" as const } };
        }),
      });
      setConfirming(false);
      setMsg(r.ok ? `${r.count}명 보냄 — 노트북이 처리합니다(위 [노트북 지금])` : (r.error ?? "보내지 못했습니다."));
      if (r.ok) setPicked({});
      router.refresh();
    });

  return (
    <div className="space-y-2">
      {canSend && rows.length > 0 && (
        <div className="flex gap-2 px-1 text-xs">
          <button type="button" className="underline" onClick={() => { setConfirming(false); setPicked(Object.fromEntries(rows.filter((r) => !r.job || r.job === "cancelled").map((r) => [r.chartNo, true]))); }}>안 보낸 환자 모두</button>
          <button type="button" className="underline" onClick={() => { setConfirming(false); setPicked({}); }}>모두 빼기</button>
        </div>
      )}
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white lg:max-h-[calc(100vh-16rem)]">
        {rows.map((r) => (
          <li key={r.chartNo} className={r.chartNo === chart ? "bg-emerald-50" : ""}>
            <div className="flex items-center gap-2 px-2 py-2 text-sm">
              {canSend && <input type="checkbox" aria-label={`${r.name} 보내기`} checked={!!picked[r.chartNo]} onChange={(e) => toggle(r.chartNo, e.target.checked)} />}
              <Link href={`/clinic?date=${date}&chart=${r.chartNo}`} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                <span className="w-11 shrink-0 text-xs text-slate-500">{r.time}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-slate-500">{r.diagnosis}</span>
                </span>
                <span className={`shrink-0 rounded px-1 text-[11px] ${VISIT_CLS[r.visit] ?? "bg-slate-100"}`}>{r.visit}</span>
                {r.job && <span title={JOB_LABEL[r.job] ?? r.job} className={`h-2 w-2 shrink-0 rounded-full ${JOB_DOT[r.job] ?? "bg-slate-300"}`} />}
              </Link>
            </div>
            {picked[r.chartNo] && r.visit !== "재진" && defaults.note && (
              <select value={tpl[r.chartNo] ?? ""} onChange={(e) => setTpl((s) => ({ ...s, [r.chartNo]: e.target.value }))} className="mx-2 mb-2 w-[calc(100%-1rem)] rounded border border-slate-300 bg-white px-1 py-1 text-xs" aria-label={`${r.name} 템플릿`}>
                <option value="">템플릿 없음(모든 칸 “.”, CC 코막힘)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.audience === "child" ? "[소아] " : ""}{t.title}</option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
      {canSend && chosen.length > 0 && (
        confirming ? (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm">
            <p>노트북으로 <b>{chosen.length}명</b> — 보내기 설정대로</p>
            <div className="flex gap-2">
              <button type="button" className={buttonStyles.accent} disabled={pending} onClick={send}>보내기 확인</button>
              <button type="button" className={buttonStyles.secondarySmall} disabled={pending} onClick={() => setConfirming(false)}>고치기</button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${buttonStyles.accent} w-full`} disabled={pending || nothing} onClick={() => { setMsg(null); setConfirming(true); }}>
            {chosen.length}명 노트북으로 보내기
          </button>
        )
      )}
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}
