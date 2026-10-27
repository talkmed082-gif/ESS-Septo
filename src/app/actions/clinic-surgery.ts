"use server";

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import type { OutpatientRow } from "@/lib/hospital-link";

// 외래 진료 중 수술하기로 한 환자 → 수술환자 관리(사용자 2026-10-27): 그 등록번호 환자가 없으면 명단 줄로 만들고(있으면 그대로),
// Plan을 수술로 표시한 뒤 그 환자 화면으로 간다(거기서 수술 계획). 본인 데이터만
export async function sendToSurgery(date: string, chartNo: string): Promise<void> {
  const { userId } = await verifySession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4,12}$/.test(chartNo)) return;
  const list = await prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: userId, date } }, select: { rows: true } });
  const row = ((list?.rows ?? []) as OutpatientRow[]).find((r) => r.chartNo === chartNo);
  if (!row) return;
  let patient = await prisma.patient.findFirst({ where: { createdById: userId, chartNo }, select: { id: true } });
  if (!patient) {
    const age = Number.parseInt(row.age ?? "", 10);
    const sex = row.sex === "M" || row.sex === "남" ? "M" : row.sex === "F" || row.sex === "여" ? "F" : null;
    patient = await prisma.patient.create({ data: { createdById: userId, chartNo, name: row.name, sex, age: Number.isFinite(age) ? age : null, memo: `${date} 외래에서 수술 결정` }, select: { id: true } });
  }
  await prisma.patientCare.upsert({
    where: { createdById_chartNo: { createdById: userId, chartNo } },
    create: { createdById: userId, chartNo, planType: "surgery" },
    update: { planType: "surgery" },
  });
  redirect(`/patients/${patient.id}`);
}
