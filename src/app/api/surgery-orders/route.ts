import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { parseFieldValues } from "@/lib/field-types";
import { surgeryOrdersFor } from "@/lib/surgery-orders";
import { buildRemarkText, remarkExtras } from "@/lib/remark";

// GET ?chartNo= : 그 환자의 가장 최근 수술기록으로 EMR 수술 오더 목록(진료실 프로그램 [수술 오더 넣기]).
// 값은 계획(planData) ← 수술 후 수정(actualData) ← 수술기록(recordData) 순으로 덮어 쓴 것
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const chartNo = (new URL(request.url).searchParams.get("chartNo") ?? "").replace(/^0+/, "");
  if (!/^\d{4,12}$/.test(chartNo)) return pcJson({ error: "등록번호가 올바르지 않습니다." }, { status: 400 });
  const patients = await prisma.patient.findMany({ where: { createdById: user.id, chartNo: { endsWith: chartNo } }, select: { id: true, chartNo: true } });
  const ids = patients.filter((p) => (p.chartNo ?? "").replace(/^0+/, "") === chartNo).map((p) => p.id);
  const rec = ids.length
    ? await prisma.opRecord.findFirst({
        where: { createdById: user.id, opPlan: { patientId: { in: ids } } },
        orderBy: { operationDate: "desc" },
        include: { opPlan: { select: { planData: true, actualData: true, chiefComplaint: true, postOpRemark: true, surgeryType: { select: { code: true } } } } },
      })
    : null;
  if (!rec) return pcJson({ found: false });
  const values = { ...parseFieldValues(rec.opPlan.planData), ...parseFieldValues(rec.opPlan.actualData), ...parseFieldValues(rec.recordData) };
  const operationDate = rec.operationDate.toISOString().slice(0, 10);
  return pcJson({
    found: true,
    operationDate,
    procedureName: rec.procedureName,
    orders: surgeryOrdersFor(rec.opPlan.surgeryType.code, values),
    // EMR 수술기록지(CreateOpNote) 넣기: 본문 = 소견 + 수술 과정(사이트 기록지와 같음), 비고 = 차트 Remark 문장
    note: {
      body: [rec.findings, rec.procedureDetail].filter(Boolean).join("\n\n"),
      remark: buildRemarkText({
        chiefComplaint: rec.opPlan.chiefComplaint ?? "",
        surgeryDate: operationDate,
        procedureName: rec.procedureName ?? "",
        postOpRemark: rec.opPlan.postOpRemark ?? "",
        extras: remarkExtras(values),
      }),
    },
  });
}
