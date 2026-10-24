import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { safeDateStr, seoulTodayAsStoredDate } from "@/lib/date-format";

// 일정 알림 — 모든 환자의 리마인더를 기한순으로 한 화면에(사용자 2026-10-24). 읽기 전용이고,
// 추가·삭제·EMR 동기화는 지금처럼 환자 화면에서 한다. 본인 계정 데이터만(createdById).
export default async function RemindersPage() {
  const { userId } = await verifySession();
  const today = seoulTodayAsStoredDate();
  const reminders = await prisma.reminder.findMany({
    where: { createdById: userId },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      dueDate: true,
      content: true,
      authorName: true,
      patient: { select: { id: true, name: true, chartNo: true } },
    },
  });
  const overdue = reminders.filter((r) => r.dueDate && r.dueDate < today).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold">일정 알림</h1>
        <p className="text-sm text-slate-500">
          전체 {reminders.length}건{overdue > 0 && <span className="text-red-600"> · 기한 지남 {overdue}건</span>}. 추가·삭제는 환자
          화면에서 합니다.
        </p>
      </div>
      {reminders.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-400">알림이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((r) => {
            const late = r.dueDate != null && r.dueDate < today;
            return (
              <li key={r.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`font-mono text-xs ${late ? "text-red-600" : "text-slate-500"}`}>
                    {safeDateStr(r.dueDate) ?? "기한 없음"}
                  </span>
                  <span className="font-medium text-slate-900">{r.title}</span>
                  <Link href={`/patients/${r.patient.id}#reminders`} className="text-emerald-700 underline">
                    {r.patient.name}
                    {r.patient.chartNo && ` ${r.patient.chartNo}`}
                  </Link>
                  {r.authorName && <span className="text-xs text-slate-400">{r.authorName}</span>}
                </div>
                {r.content && <p className="mt-1 whitespace-pre-wrap text-slate-600">{r.content}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
