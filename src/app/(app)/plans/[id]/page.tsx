import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs, parseFieldValues } from "@/lib/field-types";
import { deleteOpPlan, updateOpPlan } from "@/app/actions/op-plans";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { SurgeryPlanner } from "@/components/surgery-planner";
import { buttonStyles } from "@/lib/ui";

export default async function OpPlanPage({
  params,
  searchParams,
}: PageProps<"/plans/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  const { view: viewParam } = await searchParams;

  const plan = await prisma.opPlan.findUnique({
    where: { id },
    include: { patient: true, surgeryType: true, opRecord: { select: { id: true } } },
  });
  if (!plan) notFound();

  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };
  const planValues = parseFieldValues(plan.planData);
  const actualValues = parseFieldValues(plan.actualData);
  const isDone = plan.status === "DONE";
  // 완료된 계획은 "수술 후" 화면(수술 방법)을 열면 이전에 고친 실제 시행
  // 값(actualData)이 있으면 그걸 먼저 보여주고, 없으면 원래 계획값을 그대로
  // 보여준다 — Op Plan 표(pre)는 아래 frozenPlanValues로 planData만 따로
  // 넘겨서 이 값과 무관하게 항상 원래 계획 그대로 표시되게 한다.
  const values = { ...planValues, ...actualValues };
  // 계획을 만든 뒤에도 수술 종류를 바꿀 수 있어야 해서(예: ESS로 만들었다가
  // Septoplasty로 정정), 현재 종류 하나만이 아니라 전체 수술 종류 목록을
  // 새 계획 작성 화면과 똑같이 넘긴다.
  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{plan.patient.name} 환자 수술 계획</h1>
          <p className="mt-1 text-sm text-slate-500">{plan.surgeryType.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/plans/${plan.id}/print`} className={buttonStyles.secondarySmall}>
            인쇄용 보기
          </Link>
          <form action={deleteOpPlan.bind(null, plan.id, plan.patientId)}>
            <button type="submit" className={buttonStyles.danger}>
              계획 삭제
            </button>
          </form>
        </div>
      </div>

      <SurgeryPlanner
        surgeryTypes={surgeryTypes.map((st) => ({
          id: st.id,
          code: st.code,
          name: st.name,
          fields: parseFieldDefs(st.fields),
        }))}
        loggedIn
        nameStyle={nameStyle}
        userEmail={user.email}
        fixedPatient={{ id: plan.patient.id, name: plan.patient.name }}
        // 완료로 표시된 계획은 "수술 후" 화면(수술 방법/기록지)을 기본으로
        // 열어서, 이미 끝난 수술의 소견 입력 화면부터 다시 보여주지 않게 한다.
        // ?view= 로 명시적으로 넘어오면(저장 후 기록지 작성 버튼) 그걸 우선한다.
        defaultView={viewParam === "pre" || viewParam === "post" ? viewParam : isDone ? "post" : "pre"}
        editPlan={{
          surgeryTypeId: plan.surgeryTypeId,
          // 화면에 더 이상 날짜 입력란이 없으므로, 없던 날짜를 오늘 날짜로
          // 지어내지 않고 있는 그대로("" = 없음)를 넘겨서 수정 시 값이
          // 유지되게 한다.
          plannedDate: safeDateStr(plan.plannedDate) ?? "",
          values,
          frozenPlanValues: isDone ? planValues : undefined,
          isDone,
        }}
        action={updateOpPlan.bind(null, plan.id)}
      />
    </div>
  );
}
