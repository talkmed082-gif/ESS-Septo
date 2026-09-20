import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { updatePatient } from "@/app/actions/patients";
import { PatientForm } from "../../patient-form";

export default async function EditPatientPage({
  params,
  searchParams,
}: PageProps<"/patients/[id]/edit">) {
  await verifySession();
  const { id } = await params;
  const { from } = await searchParams;

  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const updatePatientWithId = updatePatient.bind(null, patient.id);

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-semibold">환자 정보 수정</h1>
      <PatientForm
        action={updatePatientWithId}
        submitLabel="저장"
        returnTo={typeof from === "string" ? from : undefined}
        defaultValues={{
          name: patient.name,
          chartNo: patient.chartNo ?? "",
          sex: patient.sex ?? "",
          age: patient.age != null ? String(patient.age) : "",
          memo: patient.memo ?? "",
        }}
      />
    </div>
  );
}
