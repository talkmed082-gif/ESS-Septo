"use client";

import { useOptimistic, useTransition } from "react";

// 환자 로드맵 — 할 일(□ …)은 눌러서 체크/해제(사이트에 저장). 나머지 줄은 글 그대로
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
  return (
    <div className="mt-1 space-y-0.5 rounded bg-slate-50 p-3 text-slate-700">
      {text.split("\n").map((line, i) => {
        const parts = line.split(/(□[^□]+)/).filter((p) => p.trim());
        return (
          <p key={i} className="flex flex-wrap items-center gap-x-3 break-words">
            {parts.map((p, j) => {
              if (!p.startsWith("□")) return <span key={j}>{p}</span>;
              const item = p.slice(1).trim();
              const checked = optimistic.includes(item);
              return (
                <label key={j} className="inline-flex cursor-pointer items-center gap-1">
                  <input
                    type="checkbox"
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
                  <span className={checked ? "text-slate-400 line-through" : ""}>{item}</span>
                </label>
              );
            })}
          </p>
        );
      })}
      <p className="pt-1 text-xs text-slate-400">{meta}</p>
    </div>
  );
}
