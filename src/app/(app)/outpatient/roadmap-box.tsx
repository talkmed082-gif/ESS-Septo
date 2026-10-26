"use client";

import { useOptimistic, useTransition } from "react";

// 환자 로드맵 — 할 일(□ …)은 눌러서 체크/해제(사이트에 저장). 나머지 줄은 글 그대로.
// 할 일은 맨 위 강조 칸으로 뽑아 남은 개수와 함께(사용자 2026-10-26 "할 일이 너무 강조가 안 돼 있어")
const SECTION = /^\s*(요약|경과|현재|할 일|확인)\s*[:：]/;

// 로드맵 글을 할 일(□ 항목)과 나머지 줄로 나눈다. □가 있는 줄과 "할 일:" 덩어리(다음 머리줄 전까지)는 할 일로.
// 진료 화면은 "할 일:" 머리줄 없이 □ 항목만 넘기므로 □가 있는 줄은 어디 있든 할 일
export function splitRoadmap(text: string): { todo: string[]; rest: string[] } {
  const todo: string[] = [];
  const rest: string[] = [];
  let inTodo = false;
  for (const line of text.split("\n")) {
    const m = SECTION.exec(line);
    if (m) inTodo = m[1] === "할 일";
    const items = [...line.matchAll(/□([^□\n]+)/g)].map((x) => x[1].trim()).filter(Boolean);
    if (items.length) todo.push(...items);
    else if (!inTodo) rest.push(line);
  }
  return { todo, rest };
}

export function RoadmapBox({
  text,
  done,
  meta,
  toggle,
}: {
  text: string;
  done: string[];
  meta: string;
  toggle?: (item: string) => Promise<void>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(done, (cur: string[], item: string) =>
    cur.includes(item) ? cur.filter((d) => d !== item) : [...cur, item],
  );
  const [, start] = useTransition();
  const { todo, rest } = splitRoadmap(text);
  const left = todo.filter((t) => !optimistic.includes(t)).length;
  const check = (item: string) => {
    const checked = optimistic.includes(item);
    return (
      <label key={item} className="flex cursor-pointer items-start gap-2 py-0.5">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0"
          checked={checked}
          disabled={!toggle}
          onChange={() =>
            toggle &&
            start(async () => {
              setOptimistic(item);
              await toggle(item);
            })
          }
        />
        <span className={checked ? "text-slate-400 line-through" : "font-medium text-slate-900"}>{item}</span>
      </label>
    );
  };
  return (
    <div className="mt-1 space-y-2">
      {todo.length > 0 && (
        <div className={`rounded-md border-l-4 p-3 ${left ? "border-amber-500 bg-amber-50" : "border-emerald-500 bg-emerald-50"}`}>
          <p className={`mb-1 text-sm font-semibold ${left ? "text-amber-900" : "text-emerald-800"}`}>
            할 일 {left ? `— 남은 ${left}개` : "— 모두 함"}
          </p>
          {todo.map(check)}
        </div>
      )}
      <div className="space-y-0.5 rounded bg-slate-50 p-3 text-slate-700">
        {rest.map((line, i) => (
          <p key={i} className="break-words">
            {line}
          </p>
        ))}
        <p className="pt-1 text-xs text-slate-400">{meta}</p>
      </div>
    </div>
  );
}
