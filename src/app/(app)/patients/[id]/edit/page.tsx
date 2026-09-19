import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { updatePatient } from "@/app/actions/patients";
import { safeDateStr } from "@/lib/date-format";
import { PatientForm } from "../../patient-form";

export default async function EditPatientPage({
  params,
}: PageProps<"/patients/[id]/edit">) {
  await verifySession();
  const { id } = await params;

  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const updatePatientWithId = updatePatient.bind(null, patient.id);

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-semibold">환자 정보 수정</h1>
      <PatientForm
        action={updatePatientWithId}
        submitLabel="저장"
        defaultValues={{
          name: patient.name,
          chartNo: patient.chartNo ?? "",
          sex: patient.sex ?? "",
          birthDate: safeDateStr(patient.birthDate) ?? "",
          memo: patient.memo ?? "",
        }}
      />
    </div>
  );
}
