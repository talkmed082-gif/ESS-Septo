"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTodo } from "@/app/actions/roadmap";

// 대시보드 로드맵 할 일 — 환자별 □ 항목만 모아 체크/해제(외래 명단의 로드맵과 같은 저장소)
export function TodoList({ items }: { items: { versionId: string; item: string; done: boolean }[] }) {
  const [optimistic, flip] = useOptimistic(items, (cur, key: string) =>
    cur.map((t) => (`${t.versionId}|${t.item}` === key ? { ...t, done: !t.done } : t)),
  );
  const [, start] = useTransition();
  return (
    <ul className="space-y-1">
      {optimistic.map((t) => (
        <li key={`${t.versionId}|${t.item}`}>
          <label className="inline-flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={t.done}
              onChange={() =>
                start(async () => {
                  flip(`${t.versionId}|${t.item}`);
                  await toggleTodo(t.versionId, t.item);
                })
              }
            />
            <span className={t.done ? "text-slate-400 line-through" : ""}>{t.item}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
