import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { updatePatient } from "@/app/actions/patients";
import { PatientForm } from "../../patient-form";
import { buttonStyles } from "@/lib/ui";

export default async function EditPatientPage({
  params,
  searchParams,
}: PageProps<"/patients/[id]/edit">) {
  const session = await verifySession();
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = typeof from === "string" ? from : "/patients";

  const patient = await prisma.patient.findFirst({ where: { id, createdById: session.userId } });
  if (!patient) notFound();

  const updatePatientWithId = updatePatient.bind(null, patient.id);

  return (
    <div className="max-w-lg">
      <Link href={backHref} className={`mb-2 inline-block ${buttonStyles.link}`}>
        ← 뒤로가기
      </Link>
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
