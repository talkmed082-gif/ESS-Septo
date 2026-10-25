import Link from "next/link";
import { md } from "@/components/schedule-calendar";
import type { Slot } from "@/lib/my-week";

// 대시보드 맨 위 — 오늘(주말이면 다음 월요일) 내 일정. 수술 어시스트는 교수님 수술을 순서대로, 외래 어시스트는 인원
export function TodaySchedule({ date, today, slots }: { date: string; today: string; slots: Slot[] }) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">
        {date === today ? "오늘 일정" : "다음 근무일 일정"} <span className="font-normal text-slate-500">{md(date)}</span>
      </h2>
      {slots.length === 0 ? (
        <p className="text-sm text-slate-400">정해진 일정 없음</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {slots.map((s) => (
            <div key={s.session} className="rounded-md border border-slate-200 p-3">
              <p className="text-sm">
                <span className="mr-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-white">{s.session}</span>
                <span className="font-medium">{s.title}</span>
              </p>
              <div className="mt-2 space-y-2 text-sm">
                {s.lines.map((l, i) =>
                  l.type === "text" ? (
                    <p key={i} className={l.muted ? "text-slate-400" : "text-slate-700"}>
                      {l.text}
                    </p>
                  ) : l.type === "opd" ? (
                    <Link key={i} href={`/clinic?date=${l.date}`} className="block text-emerald-700 underline">
                      {l.text}
                    </Link>
                  ) : l.type === "myPlans" ? (
                    <ol key={i} className="list-decimal space-y-0.5 pl-5">
                      {l.items.map((p) => (
                        <li key={p.id}>
                          <Link href={`/plans/${p.id}`} className="hover:underline">
                            {p.name} <span className="text-slate-500">{p.procedure}</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div key={i}>
                      <p className="text-xs text-slate-500">
                        {l.prof} 교수님 수술 {l.items.length}건
                      </p>
                      <ol className="list-decimal space-y-0.5 pl-5">
                        {l.items.map((op, j) => (
                          <li key={j}>
                            <span className="font-medium">{op.op}</span>{" "}
                            <span className="text-slate-500">
                              {op.name} {op.age}/{op.sex}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
