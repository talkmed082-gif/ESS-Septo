import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { safeDateStr, seoulTodayAsStoredDate } from "@/lib/date-format";
import { ReminderList } from "./reminder-list";

// 일정 알림 — 모든 환자의 리마인더를 기한순으로(사용자 2026-10-24). 캘린더 아래에 붙는다(2026-10-27 "캘린더 밑에 일정 알림").
// 체크하면 완료, 사이트에서 만든 것은 삭제. 추가·EMR 동기화는 환자 화면에서. 본인 데이터만
export async function RemindersSection() {
  const { userId } = await verifySession();
  const today = seoulTodayAsStoredDate();
  const reminders = await prisma.reminder.findMany({
    where: { createdById: userId },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: { id: true, title: true, dueDate: true, content: true, authorName: true, doneAt: true, source: true, emrRegSeq: true, patient: { select: { id: true, name: true, chartNo: true } } },
  });
  const open = reminders.filter((r) => !r.doneAt);
  const overdue = open.filter((r) => r.dueDate && r.dueDate < today).length;
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">일정 알림</h2>
        <p className="text-sm text-slate-500">
          남은 {open.length}건{overdue > 0 && <span className="text-red-600"> · 기한 지남 {overdue}건</span>}. 체크하면 완료, 사이트에서 만든 알림은 삭제도 됩니다(EMR에서 온 알림은 완료로). 추가는 환자 화면에서.
        </p>
      </div>
      <ReminderList
        items={reminders.map((r) => ({
          id: r.id,
          title: r.title,
          due: safeDateStr(r.dueDate),
          late: r.dueDate != null && r.dueDate < today,
          content: r.content,
          authorName: r.authorName,
          done: !!r.doneAt,
          deletable: r.source === "ESS" && !r.emrRegSeq,
          patient: r.patient,
        }))}
      />
    </section>
  );
}
