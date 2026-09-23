import "server-only";
import { prisma } from "@/lib/prisma";
import { parseFieldValues, type FieldValues } from "@/lib/field-types";
import { isNasalFindingKey } from "@/lib/op-note-defs";

function pickNasalFindings(values: FieldValues): FieldValues {
  const picked: FieldValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isNasalFindingKey(key)) continue;
    if (value === "" || value === false || value === undefined) continue;
    picked[key] = value;
  }
  return picked;
}

// 같은 환자는 수술을 여러 번 하더라도 비중격 만곡, concha bullosa, Onodi/Haller
// cell 같은 해부학적/영상 소견은 대부분 그대로다. 새 계획 작성 시 매번 다시
// 입력하지 않도록 이 환자의 가장 최근 기록(수술기록지 우선, 없으면 계획)에서
// 비강/영상 소견만 골라 재사용할 수 있게 돌려준다.
export async function getLatestNasalFindingsForPatient(
  patientId: string,
  userId: string,
): Promise<FieldValues> {
  const plans = await prisma.opPlan.findMany({
    where: { patientId, createdById: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      planData: true,
      opRecord: { select: { recordData: true } },
    },
  });

  for (const plan of plans) {
    const recordValues = plan.opRecord
      ? pickNasalFindings(parseFieldValues(plan.opRecord.recordData))
      : {};
    if (Object.keys(recordValues).length > 0) return recordValues;

    const planValues = pickNasalFindings(parseFieldValues(plan.planData));
    if (Object.keys(planValues).length > 0) return planValues;
  }

  return {};
}
