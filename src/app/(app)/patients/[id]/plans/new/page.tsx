import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldDefs } from "@/lib/field-types";
import type { NameStyle, SideNotation } from "@/lib/op-note-generator";
import { getRecentCombosForSurgeryType } from "@/lib/recent-combos";
import { getLatestNasalFindingsForPatient } from "@/lib/patient-nasal-findings";
import { PlanForm } from "./plan-form";

export default async function NewOpPlanPage({
  params,
  searchParams,
}: PageProps<"/patients/[id]/plans/new">) {
  const user = await getCurrentUser();
  const { id: patientId } = await params;
  const { surgeryTypeId } = await searchParams;

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) notFound();

  const surgeryTypes = await prisma.surgeryType.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });

  const selectedId =
    typeof surgeryTypeId === "string" ? surgeryTypeId : undefined;
  const selected = selectedId
    ? surgeryTypes.find((st) => st.id === selectedId)
    : undefined;
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-xl font-semibold">수술 계획 작성</h1>
      <p className="mb-6 text-sm text-slate-500">환자: {patient.name}</p>

      {!selected ? (
        <form className="space-y-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            수술 종류 선택
          </label>
          <select
            name="surgeryTypeId"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {surgeryTypes.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            다음
          </button>
        </form>
      ) : (
        <PlanForm
          patientId={patientId}
          surgeryTypeId={selected.id}
          surgeryTypeCode={selected.code}
          surgeryTypeName={selected.name}
          fields={parseFieldDefs(selected.fields)}
          nameStyle={nameStyle}
          recentCombos={await getRecentCombosForSurgeryType(
            user.id,
            selected.id,
            selected.code,
            nameStyle,
          )}
          patientNasalFindings={await getLatestNasalFindingsForPatient(patientId)}
        />
      )}
    </div>
  );
}
