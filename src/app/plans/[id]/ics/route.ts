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
    // 캘린더 앱 알림/잠금화면 등 외부에 노출될 수 있어 환자 이름은 넣지 않는다.
    title: `[수술] ${procedureName}`,
    date: plan.plannedDate,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="op-plan-${plan.id}.ics"`,
    },
  });
}
