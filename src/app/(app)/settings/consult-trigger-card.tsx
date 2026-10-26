import { regenerateConsultTriggerToken } from "@/app/actions/import-token";
import { CopyButton } from "@/components/copy-button";
import { buttonStyles } from "@/lib/ui";

// 아이폰 단축어로 타과의뢰 문자가 오면 [EMR에서 가져오기]를 대신 누른다. 이 토큰으로는 가져오기 요청만 된다
const URL = "https://ess-septo.vercel.app/api/consults/trigger";

export function ConsultTriggerCard({ token }: { token: string | null }) {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div>
        <p className="font-medium text-slate-800">타과의뢰 문자 → 아이폰 단축어</p>
        <p className="mt-1 text-slate-500">
          단축어 앱 → 자동화 → 새로운 자동화 → 메시지 → 보낸 사람·메시지 내용(예: 타과의뢰) → 즉시 실행 → 동작
          &ldquo;URL의 콘텐츠 가져오기&rdquo;: 아래 주소, 방법 POST, 헤더 Authorization = <code>Bearer 토큰</code>. 문자 내용은
          보내지 않습니다. 병원 PC가 10분 안에 가져옵니다.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input readOnly value={URL} aria-label="단축어 주소" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700" />
        <CopyButton text={URL} label="주소 복사" />
      </div>
      {token ? (
        <>
          <div className="flex items-center gap-2">
            <input readOnly value={`Bearer ${token}`} aria-label="단축어 헤더 값" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700" />
            <CopyButton text={`Bearer ${token}`} label="헤더 값 복사" />
          </div>
          <form action={regenerateConsultTriggerToken}>
            <button type="submit" className={buttonStyles.danger}>
              토큰 다시 만들기
            </button>
            <span className="ml-2 text-xs text-slate-400">기존 토큰은 즉시 사용할 수 없게 됩니다.</span>
          </form>
        </>
      ) : (
        <form action={regenerateConsultTriggerToken}>
          <button type="submit" className={buttonStyles.accent}>
            토큰 만들기
          </button>
        </form>
      )}
    </div>
  );
}
