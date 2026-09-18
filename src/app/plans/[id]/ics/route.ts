import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildProcedureName } from "@/lib/op-note-generator";
import { buildIcsContent } from "@/lib/calendar";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await verifySession();
  const { id } = await params;

  const plan = await prisma.opPlan.findUnique({
    where: { id },
    include: { patient: true, surgeryType: true },
  });
  if (!plan || !plan.plannedDate) {
    return NextResponse.json({ error: "예정일이 설정되지 않았습니다." }, { status: 404 });
  }

  const values = parseFieldValues(plan.planData);
  const procedureName = isBuiltInSurgeryCode(plan.surgeryType.code)
    ? buildProcedureName(plan.surgeryType.code, values)
    : plan.surgeryType.name;

  const ics = buildIcsContent({
    uid: `op-plan-${plan.id}@ess-septo`,
    title: `[수술] ${plan.patient.name} - ${procedureName}`,
    date: plan.plannedDate,
    description: [plan.diagnosis, plan.side].filter(Boolean).join(" / "),
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="op-plan-${plan.id}.ics"`,
    },
  });
}
