import { regenerateCalendarToken } from "@/app/actions/calendar";
import { CopyButton } from "@/components/copy-button";
import { buttonStyles } from "@/lib/ui";

// 구글 캘린더가 주기적으로 읽어가는 구독 주소 — 계획을 저장/수정/삭제하면 다음
// 갱신 때 캘린더에 자동으로 반영된다(갱신 주기는 구글이 정하며 보통 몇 시간~하루).
export function CalendarSubscribeCard({ feedUrl }: { feedUrl: string | null }) {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div>
        <p className="font-medium text-slate-800">구글 캘린더 자동 구독</p>
        <p className="mt-1 text-slate-500">
          아래 주소를 구글 캘린더에 한 번만 등록하면, 이후 계획을 저장·수정·삭제할 때 캘린더에도 자동으로
          반영됩니다. 수술명과 날짜만 표시되고 환자 이름은 들어가지 않습니다.
        </p>
      </div>
      {feedUrl ? (
        <>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={feedUrl}
              aria-label="캘린더 구독 주소"
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
            />
            <CopyButton text={feedUrl} label="주소 복사" />
          </div>
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-slate-500">
            <li>주소를 복사합니다.</li>
            <li>컴퓨터의 구글 캘린더 → 왼쪽 &quot;다른 캘린더&quot; 옆 + → &quot;URL로 추가&quot;에 붙여넣습니다.</li>
            <li>반영은 구글이 정한 주기(보통 몇 시간~하루)로 이루어집니다.</li>
          </ol>
          <form action={regenerateCalendarToken}>
            <button type="submit" className={buttonStyles.danger}>
              주소 다시 만들기
            </button>
            <span className="ml-2 text-xs text-slate-400">기존 주소는 즉시 사용할 수 없게 됩니다.</span>
          </form>
        </>
      ) : (
        <form action={regenerateCalendarToken}>
          <button type="submit" className={buttonStyles.accent}>
            구독 주소 만들기
          </button>
        </form>
      )}
    </div>
  );
}
