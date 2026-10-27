"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/lib/ui";
import { cancelClinicJob, saveClinicDefaults, sendToClinic } from "@/app/actions/clinic";
import { clinicDefaults, type ClinicDefaults } from "@/lib/opd-jobs";

export type ClinicJobView = { id: string; status: string; result: string | null; where: "laptop" | "clinic"; practice: boolean; updatedAt: string };
type Tpl = { id: string; title: string; audience: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "보냄 — 차례를 기다리는 중", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  running: { label: "넣는 중…", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  waiting: { label: "대기", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  done: { label: "완료", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  failed: { label: "멈춤 — 확인 필요", cls: "bg-red-50 text-red-800 border-red-200" },
  cancelled: { label: "취소함", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

// 오늘 할 일을 골라 보낸다. 노트북(기본): 노트북 작업자가 환자 선택·새 기록지부터 혼자 처리(평일 07:30~17:00 켜짐 — 전날 밤에 다음 날 하루치를 보내 둘 수 있음).
// 진료실 PC: 진료 어시스트가 3초마다 "지금 EMR에 열린 환자" 번호로만 묻고 처리(다른 환자에 안 들어감).
// 재진은 이전 이비인후과 외래기록으로 기록지, 초진·재초는 템플릿. 진단 → 비인강경 오더 → 기록지 저장 + 처방 서명
export function OrderPanel({
  chartNo,
  name,
  visit,
  visitDate,
  canSend,
  templates,
  job,
  defaults = clinicDefaults(null),
}: {
  chartNo: string;
  name: string;
  visit: string;
  visitDate: string;
  canSend: boolean;
  templates: Tpl[];
  job: ClinicJobView | null;
  defaults?: ClinicDefaults;
}) {
  const router = useRouter();
  const follow = visit === "재진";
  const [templateId, setTemplateId] = useState("");
  const [note, setNote] = useState(defaults.note);
  const [dx, setDx] = useState(defaults.dx);
  const [scope, setScope] = useState(defaults.scope);
  const [practice, setPractice] = useState(false);
  const [where, setWhere] = useState<"laptop" | "clinic">(defaults.where);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const live = job && ["pending", "running", "waiting"].includes(job.status);

  // 보낸 뒤 결과가 올 때까지 3초마다 새로 읽기
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [live, router]);

  const needTemplate = note && !follow && !templateId;
  const send = () =>
    start(async () => {
      setMsg(null);
      const r = await sendToClinic({ where, visitDate, chartNo, name, visit, templateId: templateId || null, practice, note, dx, scope });
      if (!r.ok) setMsg(r.error ?? "보내지 못했습니다.");
      router.refresh();
    });

  const st = job ? (STATUS[job.status] ?? { label: job.status, cls: "bg-slate-50 border-slate-200" }) : null;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1" role="radiogroup" aria-label="보낼 곳">
        {(
          [
            ["laptop", "노트북", "환자 선택부터 자동"],
            ["clinic", "진료실 PC", "기록지 열면 바로"],
          ] as const
        ).map(([v, label, sub]) => (
          <button key={v} type="button" role="radio" aria-checked={where === v} onClick={() => setWhere(v)} className={`rounded px-2 py-1.5 text-left ${where === v ? "bg-white shadow-sm" : "text-slate-500"}`}>
            <span className="block font-medium">{label}</span>
            <span className="block text-[11px] text-slate-500">{sub}</span>
          </button>
        ))}
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} className="mt-1" />
        <span>
          기록지 {follow ? "— 이전 이비인후과 외래기록으로 S·O·A·P" : "— 템플릿"}
          {follow && <span className="block text-xs text-slate-500">템플릿을 고르면 그 문구도 덧붙입니다</span>}
        </span>
      </label>
      <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5" aria-label="템플릿">
        <option value="">{follow ? "템플릿 없음(이전 기록만)" : "템플릿 고르기…"}</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.audience === "child" ? "[소아] " : ""}
            {t.title}
          </option>
        ))}
      </select>
      {needTemplate && <p className="text-xs text-amber-700">초진·재초는 템플릿을 고르세요(안 고르면 통증 “없음”만 체크).</p>}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={dx} onChange={(e) => setDx(e.target.checked)} />
        진단 확인(경증 주진단이면 멈춤, 없으면 템플릿 코드·J34.2)
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={scope} onChange={(e) => setScope(e.target.checked)} />
        비인강경 오더(ENTE7540) + 기록지 저장 + 처방 서명
      </label>
      {/* 지금 고른 보낼 곳·할 일을 기본값으로(사용자 2026-10-27) — 다른 환자·하루치 칸·다른 기기도 이 값으로 시작 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonStyles.secondarySmall}
          disabled={pending}
          onClick={() => start(async () => { const r = await saveClinicDefaults({ where, note, dx, scope }); setSaved(r.ok ? "이 설정을 기본으로 저장했습니다" : (r.error ?? "저장하지 못했습니다.")); })}
        >
          이 설정 저장
        </button>
        {saved && <span className="text-xs text-slate-500">{saved}</span>}
      </div>
      <label className="flex items-center gap-2 text-slate-500">
        <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} />
        연습(EMR에 쓰지 않고 할 일만 확인)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonStyles.accent} disabled={pending || !canSend || (!note && !dx && !scope)} onClick={send}>
          {live ? "다시 보내기" : where === "laptop" ? "노트북으로 보내기" : "진료실 PC로 보내기"}
        </button>
        {job && (job.status === "pending" || job.status === "waiting") && (
          <button type="button" className={buttonStyles.secondarySmall} onClick={() => start(async () => { await cancelClinicJob(job.id); router.refresh(); })}>
            취소
          </button>
        )}
        {!canSend && <span className="text-xs text-slate-400">지난 외래는 보낼 수 없습니다</span>}
      </div>
      {msg && <p className="text-red-700">{msg}</p>}
      {job && st && (
        <div className={`rounded-md border px-3 py-2 ${st.cls}`}>
          <p className="font-medium">
            {job.where === "laptop" ? "노트북 · " : "진료실 PC · "}
            {st.label}
            {job.practice ? " (연습)" : ""}
          </p>
          {job.status === "pending" && (
            <p className="mt-1 text-xs">{job.where === "laptop" ? "노트북이 그날 07:30부터 환자를 골라 처리합니다(평일 07:30~17:00, 접수 전이면 3분마다 다시)" : "진료실 PC EMR에서 이 환자 기록지를 열면 바로 넣습니다"}</p>
          )}
          {job.result && <p className="mt-1 whitespace-pre-wrap break-words text-xs">{job.result}</p>}
        </div>
      )}
    </div>
  );
}
