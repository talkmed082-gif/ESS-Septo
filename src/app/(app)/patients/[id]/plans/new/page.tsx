import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs } from "@/lib/field-types";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { getLatestNasalFindingsForPatient } from "@/lib/patient-nasal-findings";
import { SurgeryPlanner } from "@/components/surgery-planner";

export default async function NewOpPlanPage({
  params,
}: PageProps<"/patients/[id]/plans/new">) {
  const user = await getCurrentUser();
  const { id: patientId } = await params;

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) notFound();

  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };
  const patientNasalFindings = await getLatestNasalFindingsForPatient(patientId);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">수술 계획 작성</h1>
      <p className="mb-6 text-sm text-slate-500">환자: {patient.name}</p>

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
        fixedPatient={{ id: patient.id, name: patient.name }}
        patientNasalFindings={patientNasalFindings}
      />
    </div>
  );
}
