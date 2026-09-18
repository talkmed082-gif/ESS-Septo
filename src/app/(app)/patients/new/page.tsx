import { verifySession } from "@/lib/dal";
import { createPatient } from "@/app/actions/patients";
import { PatientForm } from "../patient-form";

export default async function NewPatientPage() {
  await verifySession();

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-semibold">새 환자 등록</h1>
      <PatientForm action={createPatient} submitLabel="등록" />
    </div>
  );
}
