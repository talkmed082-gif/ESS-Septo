import { createTextTemplate, deleteTextTemplate, updateTextTemplate } from "@/app/actions/text-templates";
import { buttonStyles } from "@/lib/ui";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

// 내 템플릿 — 수술 계획 화면의 "계획 메모"·"수술 후 특이사항" 칸에서 골라 넣는 문구.
export function TextTemplatesCard({ templates }: { templates: { id: string; title: string; body: string }[] }) {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div>
        <p className="font-medium text-slate-800">내 템플릿</p>
        <p className="mt-1 text-slate-500">
          수술 계획 화면의 계획 메모·수술 후 특이사항 칸에서 &quot;템플릿 넣기&quot;로 고르면 칸 끝에 그대로 붙습니다.
        </p>
      </div>
      {templates.map((t) => (
        <form key={t.id} action={updateTextTemplate.bind(null, t.id)} className="space-y-2 border-t border-slate-100 pt-3">
          <input name="title" required maxLength={60} defaultValue={t.title} aria-label="템플릿 제목" className={inputClass} />
          <textarea name="body" required rows={6} maxLength={4000} defaultValue={t.body} aria-label="템플릿 내용" className={inputClass} />
          <div className="flex gap-2">
            <button type="submit" className={buttonStyles.primarySmall}>
              저장
            </button>
            <button type="submit" formAction={deleteTextTemplate.bind(null, t.id)} className={buttonStyles.smallOutline}>
              삭제
            </button>
          </div>
        </form>
      ))}
      <form action={createTextTemplate} className="space-y-2 border-t border-slate-100 pt-3">
        <p className="font-medium text-slate-700">새 템플릿</p>
        <input name="title" required maxLength={60} placeholder="제목" aria-label="새 템플릿 제목" className={inputClass} />
        <textarea name="body" required rows={4} maxLength={4000} placeholder="내용" aria-label="새 템플릿 내용" className={inputClass} />
        <button type="submit" className={buttonStyles.primarySmall}>
          템플릿 추가
        </button>
      </form>
    </div>
  );
}
