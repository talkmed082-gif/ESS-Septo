import { verifySession } from "@/lib/dal";
import { getEmrSetOrders, getOutpatientTemplates } from "@/lib/outpatient-templates-store";
import { TEMPLATE_KINDS, type TemplateKind } from "@/lib/outpatient-templates";
import {
  createDefaultTemplates,
  createOutpatientTemplate,
  deleteOutpatientTemplate,
  updateOutpatientTemplate,
} from "@/app/actions/outpatient-templates";
import { buttonStyles } from "@/lib/ui";
import { TemplateForm, type SetOrderOption } from "./template-form";

// 외래 템플릿 — 진료실 PC 프로그램이 받아 EMR 기록지 칸을 채우고 연결한 약속처방을 오더창에 넣는다.
export default async function TemplatesPage() {
  const { userId } = await verifySession();
  const [templates, sets] = await Promise.all([getOutpatientTemplates(userId), getEmrSetOrders(userId)]);

  // 고를 수 있는 건 세트만(폴더 = 바로 다음 줄이 더 깊은 같은 사람 노드)
  const options: SetOrderOption[] = sets.flatMap((s, i) => {
    const next = sets[i + 1];
    const isFolder = next && next.ownerEmpNo === s.ownerEmpNo && next.level > s.level;
    return isFolder ? [] : [{ ownerEmpNo: s.ownerEmpNo, ownerName: s.ownerName, key: s.key, name: s.name, path: s.path }];
  });
  const owners = [...new Map(sets.map((s) => [s.ownerEmpNo, s])).values()];
  const myEmpNo = owners.length === 1 ? owners[0].ownerEmpNo : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">외래 템플릿</h1>
        <p className="text-sm text-slate-500">
          진료실 PC 프로그램에서 템플릿을 고르면 EMR 외래초진·경과 기록지 칸이 채워지고 통증평가는 &quot;없음&quot;으로
          체크됩니다. 진료 후에는 연결한 약속처방이 오더창에 들어갑니다. 저장·서명·오더 전송은 직접 누릅니다.
        </p>
        {owners.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            약속처방 목록:{" "}
            {owners
              .map((o) => `${o.ownerName || o.ownerEmpNo} ${sets.filter((s) => s.ownerEmpNo === o.ownerEmpNo).length}개 (${o.syncedAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })})`)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-slate-800">진료실 PC 프로그램 (외래 도우미)</p>
          <a href="/templates/download" className={buttonStyles.accent}>
            OpdHelper.exe 내려받기
          </a>
        </div>
        <ol className="list-decimal space-y-1 pl-5">
          <li>설치 없이 파일 하나로 실행합니다. 관리자 권한 확인 창이 뜨면 &quot;예&quot;(YES가 관리자 권한으로 돌기 때문).</li>
          <li>
            Windows가 &quot;PC 보호&quot; 창을 띄우면 &quot;추가 정보 → 실행&quot;(서명하지 않은 프로그램이라 처음 한 번 뜰 수
            있음).
          </li>
          <li>처음 실행 때 토큰을 물으면 설정 → EMR 수술 일정 연동의 토큰을 붙여넣습니다.</li>
          <li>
            YES에서 기록지(외래초진/경과)나 오더창을 연 상태로 템플릿을 고르고 [기록지 채우기]·[비인강경]·[약속처방
            넣기]를 누릅니다. 이미 쓴 칸은 건드리지 않습니다.
          </li>
        </ol>
      </div>

      {templates.length === 0 && (
        <form action={createDefaultTemplates} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
          <p className="mb-2 text-slate-600">
            템플릿이 없습니다. 증상 7개(코골이/수면무호흡, 콧물, 코막힘, 두통/안면통, 재채기/알레르기, 인후두 이물감,
            무후각증), 진단 2개(부비동염, 종물), 검사 1개(비인강경 — 프로그램의 [비인강경] 버튼이 씀) 초안을 만들어 고쳐 쓸 수 있습니다.
          </p>
          <button type="submit" className={buttonStyles.primarySmall}>
            기본 템플릿 초안 만들기
          </button>
        </form>
      )}

      {templates.map((t) => (
        <details key={t.id} className="rounded-md border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            {t.title}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {TEMPLATE_KINDS[t.kind as TemplateKind] ?? t.kind}
              {t.setOrders.length > 0 && ` · 약속처방 ${t.setOrders.length}개`}
            </span>
          </summary>
          <div className="mt-3">
            <TemplateForm
              template={t}
              options={options}
              myEmpNo={myEmpNo}
              action={updateOutpatientTemplate.bind(null, t.id)}
              deleteAction={deleteOutpatientTemplate.bind(null, t.id)}
            />
          </div>
        </details>
      ))}

      <details className="rounded-md border border-dashed border-slate-300 bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">새 템플릿</summary>
        <div className="mt-3">
          <TemplateForm template={null} options={options} myEmpNo={myEmpNo} action={createOutpatientTemplate} />
        </div>
      </details>
    </div>
  );
}
