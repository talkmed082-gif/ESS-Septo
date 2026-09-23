import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { SurgeryPlanner } from "@/components/surgery-planner";

export default async function NewPatientPage() {
  const user = await getCurrentUser();

  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">새 환자 등록</h1>
      <p className="mb-6 text-sm text-slate-500">
        환자 정보와 수술 계획을 한 번에 작성할 수 있습니다.
      </p>
      <SurgeryPlanner
        surgeryTypes={surgeryTypes.map((st) => ({
          id: st.id,
          code: st.code,
          name: st.name,
          fields: resolveSurgeryTypeFields(st),
        }))}
        loggedIn
        nameStyle={nameStyle}
        userEmail={user.email}
        userName={user.name}
      />
    </div>
  );
}
