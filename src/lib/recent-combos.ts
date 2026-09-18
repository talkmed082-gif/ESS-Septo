import "server-only";
import { prisma } from "@/lib/prisma";
import { parseFieldValues, type FieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildProcedureName, type NameStyle } from "@/lib/op-note-generator";

export interface RecentCombo {
  label: string;
  values: FieldValues;
}

// 이 사용자가 해당 수술 종류로 최근에 만든 계획들 중, planData 조합이 서로 다른
// 것만 최신순으로 추려서 반환한다 (매번 같은 조합으로 수술하는 경우가 많아
// 새 계획/기록 작성 시 클릭 한 번으로 재사용할 수 있게 함).
export async function getRecentCombosForSurgeryType(
  userId: string,
  surgeryTypeId: string,
  surgeryTypeCode: string,
  nameStyle: NameStyle,
  limit = 5,
): Promise<RecentCombo[]> {
  const plans = await prisma.opPlan.findMany({
    where: { createdById: userId, surgeryTypeId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { planData: true },
  });

  const seen = new Set<string>();
  const combos: RecentCombo[] = [];
  for (const plan of plans) {
    const values = parseFieldValues(plan.planData);
    if (Object.keys(values).length === 0) continue;
    const dedupeKey = JSON.stringify(values);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const label = isBuiltInSurgeryCode(surgeryTypeCode)
      ? buildProcedureName(surgeryTypeCode, values, nameStyle)
      : `최근 조합 ${combos.length + 1}`;
    combos.push({ label, values });
    if (combos.length >= limit) break;
  }
  return combos;
}

export async function getRecentCombosForSurgeryTypes(
  userId: string,
  surgeryTypes: { id: string; code: string }[],
  nameStyle: NameStyle,
  limit = 5,
): Promise<Record<string, RecentCombo[]>> {
  const entries = await Promise.all(
    surgeryTypes.map(async (st) => [
      st.id,
      await getRecentCombosForSurgeryType(userId, st.id, st.code, nameStyle, limit),
    ] as const),
  );
  return Object.fromEntries(entries);
}
