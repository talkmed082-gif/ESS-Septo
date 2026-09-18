import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldDefs } from "@/lib/field-types";
import { NewPatientPlanForm } from "./new-patient-plan-form";

export default async function NewPatientPage() {
  await verifySession();

  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-xl font-semibold">새 환자 등록</h1>
      <p className="mb-6 text-sm text-slate-500">
        환자 정보와 수술 계획을 한 번에 작성할 수 있습니다.
      </p>
      <NewPatientPlanForm
        surgeryTypes={surgeryTypes.map((st) => ({
          id: st.id,
          code: st.code,
          name: st.name,
          fields: parseFieldDefs(st.fields),
        }))}
      />
    </div>
  );
}
