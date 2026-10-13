import { deleteReminder } from "@/app/actions/reminders";
import { safeDateStr } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";

export interface ReminderItem {
  id: string;
  title: string;
  dueDate: Date | null;
  content: string | null;
  authorName: string | null;
  source: string;
  emrRegSeq: string | null;
}

// 환자 리마인더 목록 — 환자 화면(추가·삭제 가능)과 수술 계획 화면(읽기 전용)이 같이 쓴다.
// 삭제는 아직 EMR에 안 올라간(이 사이트에서 만든) 것만 가능하다.
export function ReminderList({
  reminders,
  patientId,
  allowDelete = false,
}: {
  reminders: ReminderItem[];
  patientId: string;
  allowDelete?: boolean;
}) {
  if (reminders.length === 0) return null;
  return (
    <ul className="space-y-2">
      {reminders.map((r) => {
        const pendingPush = r.source === "ESS" && !r.emrRegSeq;
        return (
          <li key={r.id} className="rounded-md border border-slate-200 p-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{r.title}</span>
              {r.dueDate && <span className="text-xs text-slate-500">~{safeDateStr(r.dueDate)}</span>}
              {r.authorName && <span className="text-xs text-slate-400">{r.authorName}</span>}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${pendingPush ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}
              >
                {pendingPush ? "EMR 올리기 대기" : "EMR"}
              </span>
              {allowDelete && pendingPush && (
                <form action={deleteReminder.bind(null, r.id, patientId)} className="ml-auto">
                  <button type="submit" className={buttonStyles.smallOutline}>
                    삭제
                  </button>
                </form>
              )}
            </div>
            {r.content && <p className="mt-1 whitespace-pre-wrap text-slate-600">{r.content}</p>}
          </li>
        );
      })}
    </ul>
  );
}
