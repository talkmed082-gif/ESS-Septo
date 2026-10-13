import { regenerateImportToken } from "@/app/actions/import-token";
import { CopyButton } from "@/components/copy-button";
import { buttonStyles } from "@/lib/ui";

// 병원 PC 스크립트가 EMR 수술 일정에서 내 집도 건을 골라 수술 계획으로 올릴 때 쓰는 토큰.
// 등록번호로 기존 환자를 찾아 쓰고, 같은 날짜·같은 수술은 다시 만들지 않는다.
export function ImportTokenCard({ token }: { token: string | null }) {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div>
        <p className="font-medium text-slate-800">병원 PC 자동 등록</p>
        <p className="mt-1 text-slate-500">
          병원 PC가 매일 EMR 수술 일정에서 내 수술을 찾아 환자와 수술 계획을 자동으로 만듭니다. 아래 토큰을
          병원 PC에 한 번 저장해 두세요. 토큰을 아는 사람은 이 계정에 수술 계획을 만들 수 있습니다.
        </p>
      </div>
      {token ? (
        <>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={token}
              aria-label="자동 등록 토큰"
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700"
            />
            <CopyButton text={token} label="토큰 복사" />
          </div>
          <form action={regenerateImportToken}>
            <button type="submit" className={buttonStyles.danger}>
              토큰 다시 만들기
            </button>
            <span className="ml-2 text-xs text-slate-400">기존 토큰은 즉시 사용할 수 없게 됩니다.</span>
          </form>
        </>
      ) : (
        <form action={regenerateImportToken}>
          <button type="submit" className={buttonStyles.accent}>
            토큰 만들기
          </button>
        </form>
      )}
    </div>
  );
}
