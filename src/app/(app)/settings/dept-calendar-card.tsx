import { regenerateDeptCalendarToken } from "@/app/actions/calendar";
import { CopyButton } from "@/components/copy-button";
import { buttonStyles } from "@/lib/ui";

// 비과 전체 일정(교수님 4분 수술·외래·부재) 구독 주소(사용자 2026-10-28) — 계정 없는 선생님께도 주소만 건네면
// 구글/애플 캘린더에서 볼 수 있다. 병원 PC가 교수님 일정을 다시 올리면 다음 갱신 때 캘린더에도 반영된다.
export function DeptCalendarCard({ feedUrl }: { feedUrl: string | null }) {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <p className="text-slate-500">
        정일구·문수진·박지환·최성욱 교수님의 수술·외래(오전/오후)·휴가/출장을 캘린더 하나로 구독합니다. 환자 이름은
        가운데를 가리고(홍*동) 등록번호는 넣지 않습니다. 주소를 아는 사람은 로그인 없이 볼 수 있으니 필요한 분께만
        건네세요.
      </p>
      {feedUrl ? (
        <>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={feedUrl}
              aria-label="비과 일정 구독 주소"
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
            />
            <CopyButton text={feedUrl} label="주소 복사" />
          </div>
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-slate-500">
            <li>구글 캘린더(컴퓨터): 왼쪽 &quot;다른 캘린더&quot; 옆 + → &quot;URL로 추가&quot;에 붙여넣기</li>
            <li>아이폰: 설정 → 캘린더 → 계정 → 계정 추가 → 기타 → &quot;구독 캘린더 추가&quot;에 붙여넣기</li>
            <li>반영 주기는 캘린더 앱이 정합니다(보통 몇 시간~하루).</li>
          </ol>
          <form action={regenerateDeptCalendarToken}>
            <button type="submit" className={buttonStyles.danger}>
              주소 다시 만들기
            </button>
            <span className="ml-2 text-xs text-slate-400">기존 주소(건네준 것 포함)는 즉시 사용할 수 없게 됩니다.</span>
          </form>
        </>
      ) : (
        <form action={regenerateDeptCalendarToken}>
          <button type="submit" className={buttonStyles.accent}>
            구독 주소 만들기
          </button>
        </form>
      )}
    </div>
  );
}
