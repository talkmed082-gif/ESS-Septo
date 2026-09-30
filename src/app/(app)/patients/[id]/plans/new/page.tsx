import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { getLatestNasalFindingsForPatient } from "@/lib/patient-nasal-findings";
import { SurgeryPlanner } from "@/components/surgery-planner";

export default async function NewOpPlanPage({
  params,
}: PageProps<"/patients/[id]/plans/new">) {
  const user = await getCurrentUser();
  const { id: patientId } = await params;

  // 환자·수술 종류·이전 비강 소견은 서로 상관없어서 동시에 가져온다.
  const [patient, surgeryTypes, patientNasalFindings] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, createdById: user.id } }),
    prisma.surgeryType.findMany({ orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }] }),
    getLatestNasalFindingsForPatient(patientId, user.id),
  ]);
  if (!patient) notFound();
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">수술 계획 작성</h1>
      <p className="mb-6 text-sm text-slate-500">환자: {patient.name}</p>

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
        fixedPatient={{ id: patient.id, name: patient.name }}
        patientNasalFindings={patientNasalFindings}
      />
    </div>
  );
}
