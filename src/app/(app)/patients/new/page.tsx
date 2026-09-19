import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs } from "@/lib/field-types";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { getRecentCombosForSurgeryTypes } from "@/lib/recent-combos";
import { getPresetsForSurgeryTypes } from "@/lib/presets";
import { SurgeryPlanner, type ExistingPatientOption } from "@/components/surgery-planner";

export default async function NewPatientPage() {
  const user = await getCurrentUser();

  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };
  const recentCombosByType = await getRecentCombosForSurgeryTypes(
    user.id,
    surgeryTypes.map((st) => ({ id: st.id, code: st.code })),
    nameStyle,
  );
  const presetsByType = await getPresetsForSurgeryTypes(
    user.id,
    surgeryTypes.map((st) => st.id),
  );
  const existingPatients: ExistingPatientOption[] = await prisma.patient.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, chartNo: true },
  });

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-xl font-semibold">새 환자 등록</h1>
      <p className="mb-6 text-sm text-slate-500">
        환자 정보와 수술 계획을 한 번에 작성할 수 있습니다.
      </p>
      <SurgeryPlanner
        surgeryTypes={surgeryTypes.map((st) => ({
          id: st.id,
          code: st.code,
          name: st.name,
          fields: parseFieldDefs(st.fields),
        }))}
        loggedIn
        nameStyle={nameStyle}
        recentCombosByType={recentCombosByType}
        presetsByType={presetsByType}
        existingPatients={existingPatients}
      />
    </div>
  );
}
