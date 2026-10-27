import { verifySession } from "@/lib/dal";
import { getEmrSetOrders, getOutpatientTemplates } from "@/lib/outpatient-templates-store";
import { AUDIENCES, TEMPLATE_KINDS, type Audience, type TemplateKind } from "@/lib/outpatient-templates";
import Link from "next/link";
import { SETTINGS_TABS, SectionTabs } from "@/components/section-tabs";
import { RxBundleForm } from "./rx-bundle-form";
import { getRxBundles } from "@/lib/rx-bundles-store";
import { createDefaultRx, deleteRxBundle, updateRxBundle } from "@/app/actions/rx-bundles";
import {
  createDefaultTemplates,
  createOutpatientTemplate,
  deleteOutpatientTemplate,
  replaceTemplatesWithDefaults,
  updateOutpatientTemplate,
} from "@/app/actions/outpatient-templates";
import { buttonStyles } from "@/lib/ui";
import { TemplateForm, type SetOrderOption } from "./template-form";

// 외래 템플릿 — 진료실 PC 프로그램이 받아 EMR 기록지 칸을 채우고 연결한 약속처방을 오더창에 넣는다.
export default async function TemplatesPage() {
  const { userId } = await verifySession();
  const [templates, sets, rxBundles] = await Promise.all([
    getOutpatientTemplates(userId),
    getEmrSetOrders(userId),
    getRxBundles(userId),
  ]);

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
        <h1 className="mb-4 text-xl font-semibold">설정</h1>
        <SectionTabs tabs={SETTINGS_TABS} current="/templates" />
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

      <p className="text-sm text-slate-500">
        진료실 PC 프로그램(외래 도우미) 내려받기·사용법은{" "}
        <Link href="/hospital#opd-helper" className="underline">
          설정 &gt; 병원 연동
        </Link>
        에 있습니다.
      </p>

      {(Object.keys(AUDIENCES) as Audience[]).map((aud) => {
        const list = templates.filter((t) => (t.audience ?? "adult") === aud);
        const numbered = list.filter((t) => t.kind !== "exam");
        const explicit = numbered.some((t) => t.shortcut != null);
        const num = (t: (typeof list)[number]) =>
          t.kind === "exam" ? null : explicit ? t.shortcut : numbered.indexOf(t) + 1;
        return (
          <section key={aud} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">
                {AUDIENCES[aud]} 템플릿 <span className="font-normal text-slate-400">({aud === "adult" ? "15세 이상" : "15세 미만"})</span>
              </h2>
              {list.length > 0 && (
                <form action={replaceTemplatesWithDefaults.bind(null, aud)} className="flex items-center gap-2 text-xs text-slate-400">
                  <span>증상·진단 템플릿을 코 중심 새 초안으로(고친 문구는 사라짐, 비인강경은 그대로)</span>
                  <button type="submit" className={buttonStyles.danger}>
                    새 초안으로 바꾸기
                  </button>
                </form>
              )}
            </div>
            {list.length === 0 && (
              <form action={createDefaultTemplates.bind(null, aud)} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                <p className="mb-2 text-slate-600">
                  {aud === "adult"
                    ? "성인 템플릿이 없습니다. 증상 7개, 진단 2개(부비동염, 종물), 검사 1개(비인강경) 초안을 만들어 고쳐 쓸 수 있습니다."
                    : "소아 템플릿이 없습니다. 코골이·입벌림, 콧물·코막힘, 중이염·귀 통증, 청력·검진 이상, 재채기/알레르기, 코피 초안을 만들어 고쳐 쓸 수 있습니다."}
                </p>
                <button type="submit" className={buttonStyles.primarySmall}>
                  {AUDIENCES[aud]} 기본 초안 만들기
                </button>
              </form>
            )}
            {list.map((t) => (
              <details key={t.id} className="rounded-md border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-800">
                  {num(t) != null && <span className="mr-2 rounded bg-slate-100 px-1.5 font-mono text-xs text-slate-600">{num(t)}</span>}
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
          </section>
        );
      })}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">처방 묶음(약물치료)</h2>
        <p className="text-xs text-slate-500">
          진료실 프로그램 [약물치료]에서 골라 오더 표에 바로 넣습니다(전송은 직접). 병원에서 지금 처방 가능한 약만 넣었고, 소아는 나이·몸무게로
          KIMS 허가 용량을 계산합니다. 숫자는 초안이니 확인 후 고쳐 쓰세요.
        </p>
        {(["adult", "child"] as const).map((aud) => {
          const list = rxBundles.filter((b) => b.audience === aud);
          return (
            <div key={aud} className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">{AUDIENCES[aud]}</p>
              {list.length === 0 && (
                <form action={createDefaultRx.bind(null, aud)}>
                  <button type="submit" className={buttonStyles.primarySmall}>
                    {AUDIENCES[aud]} 처방 묶음 초안 만들기
                  </button>
                </form>
              )}
              {list.map((b) => (
                <details key={b.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {b.title} <span className="text-xs font-normal text-slate-400">약 {b.items.length}개</span>
                  </summary>
                  <div className="mt-2">
                    <RxBundleForm bundle={b} action={updateRxBundle.bind(null, b.id)} deleteAction={deleteRxBundle.bind(null, b.id)} />
                  </div>
                </details>
              ))}
            </div>
          );
        })}
      </section>

      <details className="rounded-md border border-dashed border-slate-300 bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">새 템플릿</summary>
        <div className="mt-3">
          <TemplateForm template={null} options={options} myEmpNo={myEmpNo} action={createOutpatientTemplate} />
        </div>
      </details>
    </div>
  );
}
