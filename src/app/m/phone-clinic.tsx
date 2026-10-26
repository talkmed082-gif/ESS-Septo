"use client";

import { useEffect, useRef, useState } from "react";
import { toggleTodo } from "@/app/actions/roadmap";
import { askClinicClaude, getClinicAsk, setVisitDone } from "@/app/actions/clinic-ask";
import { ASK_MAX, ASK_PRESETS, type VisitStatus } from "@/lib/clinic-ask";
import Link from "next/link";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { RoadmapBox } from "../(app)/outpatient/roadmap-box";

export type MPatient = {
  no: number;
  time: string;
  name: string;
  chartNo: string;
  visit: string;
  diagnosis: string;
  sex: string;
  age: string;
  summary: string;
  core: string;
  now: string;
  check: string;
  todo: string;
  roadmap: { id: string; done: string[] } | null;
  soap: { S: string; O: string; A: string; P: string };
  course: string[];
  stages: string[];
  visits: { date: string; summary: string }[];
  surgeries: { date: string; name: string; done: boolean }[];
  nextVisit: string | null;
  status: VisitStatus;
  manual: boolean | null;
};

// 진료 전 초록, 진료 중 주황, 완료 회색(사용자 2026-10-26). 고른 환자는 검은 테두리
const STATUS_CLS: Record<VisitStatus, string> = {
  wait: "border border-emerald-300 bg-emerald-50 text-emerald-900",
  now: "border border-amber-400 bg-amber-400 text-white",
  done: "border border-slate-200 bg-slate-200 text-slate-400",
};
const STATUS_TEXT: Record<VisitStatus, string> = { wait: "진료 전", now: "진료 중", done: "완료" };
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const VISIT_CLS: Record<string, string> = { 초진: "bg-sky-100 text-sky-800", 재초: "bg-violet-100 text-violet-800", 재진: "bg-slate-100 text-slate-600" };
const card = "rounded-xl border border-slate-200 bg-white p-3";

// Claude 앱에 붙여 넣을 요약 — 이름·등록번호는 넣지 않는다
function summaryText(p: MPatient) {
  const soap = (["S", "O", "A", "P"] as const).filter((k) => p.soap[k]).map((k) => `${k}: ${p.soap[k]}`);
  return [
    `${p.visit} · ${p.diagnosis}`,
    p.summary && `요약: ${p.summary}`,
    p.core && `오늘: ${p.core}`,
    p.now && `현재: ${p.now}`,
    p.todo && `할 일: ${p.todo}`,
    p.check && `확인: ${p.check}`,
    p.course.length > 0 && `경과:\n${p.course.map((c) => `- ${c}`).join("\n")}`,
    p.surgeries.length > 0 && `수술: ${p.surgeries.map((s) => `${s.date} ${s.name}${s.done ? "" : "(예정)"}`).join(", ")}`,
    soap.length > 0 && `SOAP:\n${soap.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

type Ask = { id: string; question: string; state: string; answer: string | null };
const STATE_TEXT: Record<string, string> = {
  waiting: "노트북이 가져가기를 기다리는 중…",
  running: "노트북이 기록을 읽고 답하는 중…",
  nopickup: "노트북 응답 없음 — 노트북 진료 어시스트가 꺼져 있을 수 있습니다",
  timeout: "답이 너무 늦어 멈춤 — 다시 물어 주세요",
  failed: "실패",
};

export function PhoneClinic({ date, today, clinic, patients }: { date: string; today: string; clinic: string; patients: MPatient[] }) {
  // 처음 고를 환자: 진료 중 → 첫 진료 전 → 1번
  const [no, setNo] = useState<number | null>(() => (patients.find((x) => x.status === "now") ?? patients.find((x) => x.status === "wait") ?? patients[0])?.no ?? null);
  const [asks, setAsks] = useState<Record<string, Ask[]>>({});
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  // 폰에서 직접 바꾼 완료 표시(새로고침 전까지 화면에 바로)
  const [local, setLocal] = useState<Record<string, VisitStatus>>({});
  const st = (x: MPatient) => local[x.chartNo] ?? x.status;
  const p = patients.find((x) => x.no === no) ?? null;
  // 할 일 체크는 이 화면에 바로 기억(사용자 2026-10-26 "왔다갔다 하면 체크가 씹힌다" — 화면 데이터는 처음 한 번만 읽어서 예전 체크로 돌아갔음)
  const [doneBy, setDoneBy] = useState<Record<string, string[]>>({});
  const cardRef = useRef<HTMLDivElement>(null);
  // 명단에서 고르면 보기를 바꾸지 않고 환자 카드로만 부드럽게 내려간다(예전엔 번호 보기로 바뀌며 화면이 튀었음)
  const pick = (n: number) => {
    setNo(n);
    setCopied(false);
    if (view === "list") requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const counts = { wait: 0, now: 0, done: 0 };
  for (const x of patients) counts[st(x)]++;

  return (
    <div className="mx-auto min-h-screen max-w-xl space-y-3 overflow-x-hidden bg-slate-50 px-4 pb-10 pt-3 text-slate-900">
      <PullToRefresh />
      <div className="flex items-baseline justify-between">
        <h1 className="text-base font-semibold">
          <Link href="/dashboard" className="mr-2 text-slate-400" aria-label="메인으로">
            ‹
          </Link>
          진료 브리핑
        </h1>
        <p className="text-xs text-slate-500">
          {clinic} · {patients.length}명
        </p>
      </div>
      {/* 외래 날짜 고르기 — 다른 날 명단도 볼 수 있게 */}
      <div className="flex items-center gap-1">
        <Link href={`/m?date=${addDays(date, -1)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" aria-label="전날">
          ‹
        </Link>
        <form action="/m" className="flex min-w-0 flex-1 gap-1">
          <input type="date" name="date" defaultValue={date} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-base" />
          <button type="submit" className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            보기
          </button>
        </form>
        <Link href={`/m?date=${addDays(date, 1)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" aria-label="다음 날">
          ›
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        {date}
        {date === today ? " (오늘)" : ""} · 진료 전 {counts.wait} · 진료 중 {counts.now} · 완료 {counts.done}
      </p>
      {patients.length === 0 ? (
        <p className="text-sm text-slate-500">이 날짜에 외래 명단이 없습니다.</p>
      ) : (
        <>
          <div className="flex gap-1 rounded-lg bg-slate-200 p-1 text-sm">
            {(["grid", "list"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`flex-1 rounded-md py-1.5 ${view === v ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}>
                {v === "grid" ? "번호" : "명단"}
              </button>
            ))}
          </div>
          {view === "grid" ? (
            <div className="grid grid-cols-8 gap-1.5">
              {patients.map((x) => (
                <button
                  key={x.no}
                  type="button"
                  onClick={() => pick(x.no)}
                  className={`h-10 rounded-lg text-sm font-semibold ${STATUS_CLS[st(x)]} ${x.no === no ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
                >
                  {x.no}
                </button>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {patients.map((x) => (
                <li key={x.no}>
                  <button type="button" onClick={() => pick(x.no)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${x.no === no ? "bg-slate-100" : ""}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${STATUS_CLS[st(x)]}`}>{x.no}</span>
                    <span className="w-10 shrink-0 text-xs text-slate-500">{x.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        <span className={st(x) === "done" ? "text-slate-400" : "font-medium"}>{x.name}</span>{" "}
                        <span className="text-xs text-slate-500">
                          {[x.sex, x.age].filter(Boolean).join("/")} {x.chartNo}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-slate-500">{x.diagnosis}</span>
                    </span>
                    <span className={`shrink-0 rounded px-1 text-[11px] ${VISIT_CLS[x.visit] ?? "bg-slate-100"}`}>{x.visit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {p && (
        <>
          <div ref={cardRef} className={`${card} scroll-mt-2 space-y-1`}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-2xl font-bold text-emerald-700">{p.no}번</span>
              <span className="text-lg font-semibold">{p.name}</span>
              {(p.sex || p.age) && <span className="text-sm text-slate-700">{[p.sex, p.age].filter(Boolean).join(" / ")}</span>}
              <span className="text-sm text-slate-500">{p.chartNo}</span>
              <span className="text-xs text-slate-500">{p.time}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs ${VISIT_CLS[p.visit] ?? "bg-slate-100"}`}>{p.visit}</span>
              <button
                type="button"
                className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLS[st(p)]}`}
                onClick={() => {
                  const before = st(p);
                  const done = before !== "done";
                  setLocal((cur) => ({ ...cur, [p.chartNo]: done ? "done" : "wait" }));
                  setVisitDone(date, p.chartNo, done).catch(() => setLocal((cur) => ({ ...cur, [p.chartNo]: before })));
                }}
              >
                {STATUS_TEXT[st(p)]} {st(p) === "done" ? "↺" : "→ 완료"}
              </button>
            </div>
            <p className="text-sm text-slate-700">{p.diagnosis}</p>
            {p.stages.length > 0 && <p className="text-xs text-slate-500">{p.stages.join(" / ")}</p>}
            {p.summary && <p className="text-sm">{p.summary}</p>}
            {p.core && <p className="rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-900">오늘: {p.core}</p>}
            {p.nextVisit && <p className="text-xs text-slate-500">잡힌 다음 외래 {p.nextVisit}</p>}
          </div>

          {p.todo && (
            <div className="text-sm">
              {p.roadmap ? (
                <RoadmapBox
                  key={p.chartNo}
                  text={p.todo}
                  done={doneBy[p.roadmap.id] ?? p.roadmap.done}
                  meta="할 일 — 눌러서 체크"
                  toggle={async (item) => {
                    const id = p.roadmap!.id;
                    const cur = doneBy[id] ?? p.roadmap!.done;
                    setDoneBy((m) => ({ ...m, [id]: cur.includes(item) ? cur.filter((d) => d !== item) : [...cur, item] }));
                    await toggleTodo(id, item);
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap rounded-md border-l-4 border-amber-500 bg-amber-50 p-3">{p.todo}</p>
              )}
            </div>
          )}
          {(p.now || p.check) && (
            <div className={`${card} space-y-2 text-sm`}>
              {p.now && (
                <p>
                  <span className="text-xs text-slate-500">현재 </span>
                  {p.now}
                </p>
              )}
              {p.check && <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">확인: {p.check}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-11 rounded-lg border border-slate-300 bg-white text-sm font-medium"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(summaryText(p));
                  setCopied(true);
                } catch {
                  setCopied(false);
                  alert("복사하지 못했습니다.");
                }
              }}
            >
              {copied ? "복사됨 ✓" : "요약 복사"}
            </button>
            <a href="#ask" className="flex h-11 items-center justify-center rounded-lg bg-slate-900 text-sm font-medium text-white">
              Claude에게 묻기
            </a>
          </div>

          {(p.soap.S || p.soap.O || p.soap.A || p.soap.P) && (
            <details className={card} open>
              <summary className="cursor-pointer text-sm font-semibold text-slate-500">SOAP (AI 요약)</summary>
              <div className="mt-2 space-y-2">
                {(["S", "O", "A", "P"] as const)
                  .filter((k) => p.soap[k])
                  .map((k) => (
                    <div key={k} className="flex gap-2 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">{k}</span>
                      <p className="min-w-0 whitespace-pre-wrap break-words text-slate-700">{p.soap[k]}</p>
                    </div>
                  ))}
              </div>
            </details>
          )}

          {(p.course.length > 0 || p.visits.length > 0 || p.surgeries.length > 0) && (
            <details className={card}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-500">경과 · 지난 외래 · 수술</summary>
              <div className="mt-2 space-y-3 text-sm">
                {p.surgeries.length > 0 && (
                  <ul className="space-y-0.5">
                    {p.surgeries.map((s, i) => (
                      <li key={i}>
                        <span className="text-slate-500">{s.date}</span> {s.name}
                        {!s.done && <span className="text-amber-700"> (예정)</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {p.course.length > 0 && (
                  <ol className="space-y-1 border-l-2 border-slate-200 pl-3">
                    {p.course.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ol>
                )}
                {p.visits.length > 0 && (
                  <ul className="space-y-1">
                    {p.visits.map((v) => (
                      <li key={v.date}>
                        <span className="text-slate-500">{v.date}</span> {v.summary}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          )}

          <AskBox
            key={p.chartNo}
            date={date}
            chartNo={p.chartNo}
            asks={asks[p.chartNo] ?? []}
            onChange={(list) => setAsks((cur) => ({ ...cur, [p.chartNo]: list }))}
          />
        </>
      )}
    </div>
  );
}

// 질문을 남기고 3초마다 답을 묻는다(답이 오거나 멈출 때까지만). 노트북이 6개월 기록으로 3~5줄 답
function AskBox({ date, chartNo, asks, onChange }: { date: string; chartNo: string; asks: Ask[]; onChange: (a: Ask[]) => void }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const latest = useRef(asks);
  const change = useRef(onChange);
  useEffect(() => {
    latest.current = asks;
    change.current = onChange;
  });
  const pendingId = asks.find((a) => a.state === "waiting" || a.state === "running")?.id;

  useEffect(() => {
    if (!pendingId) return;
    const t = setInterval(async () => {
      const r = await getClinicAsk(pendingId).catch(() => null);
      if (!r) return;
      change.current(latest.current.map((a) => (a.id === pendingId ? { ...a, state: r.state, answer: r.answer } : a)));
    }, 3000);
    return () => clearInterval(t);
  }, [pendingId]);

  const send = async (q: string) => {
    if (sending || pendingId) return;
    setErr("");
    setSending(true);
    const r = await askClinicClaude({ visitDate: date, chartNo, question: q }).catch(() => ({ error: "보내지 못했습니다." }));
    setSending(false);
    if ("error" in r) return setErr(r.error);
    setText("");
    onChange([{ id: r.id, question: q, state: "waiting", answer: null }, ...latest.current]);
  };

  const busy = sending || !!pendingId;
  return (
    <section id="ask" className={`${card} space-y-2`}>
      <h2 className="text-sm font-semibold text-slate-500">Claude에게 묻기 (노트북 · 6개월 기록)</h2>
      <div className="flex flex-wrap gap-1.5">
        {ASK_PRESETS.map((q) => (
          <button key={q} type="button" disabled={busy} onClick={() => send(q)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40">
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send(text.trim());
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={ASK_MAX}
          placeholder="직접 질문"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        <button type="submit" disabled={busy || !text.trim()} className="shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40">
          묻기
        </button>
      </form>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {asks.map((a) => (
        <div key={a.id} className="space-y-1 border-t border-slate-100 pt-2 text-sm">
          <p className="font-medium">Q. {a.question}</p>
          {a.state === "done" ? (
            <p className="whitespace-pre-wrap text-slate-800">{a.answer}</p>
          ) : (
            <p className={a.state === "waiting" || a.state === "running" ? "text-slate-500" : "text-red-600"}>
              {STATE_TEXT[a.state] ?? a.state}
              {a.state === "failed" && a.answer ? ` — ${a.answer}` : ""}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
