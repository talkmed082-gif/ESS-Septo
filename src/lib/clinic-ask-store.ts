import "server-only";
import { prisma } from "@/lib/prisma";
import { latestRoadmaps } from "@/lib/roadmap-store";
import type { OutpatientRow } from "@/lib/hospital-link";
import { ASK_PICKUP_MS } from "@/lib/clinic-ask";

// 노트북 작업자가 질문 하나를 가져간다(처리 중으로). 1분 넘게 아무도 안 가져간 질문은 폰에서 "응답 없음"으로 끝났으니 두지 않는다.
// 노트북이 사이트를 따로 묻지 않게 로드맵·그날 SOAP 요약을 같이 준다
export async function claimClinicAsk(userId: string, now: Date) {
  const ask = await prisma.clinicAsk.findFirst({
    where: { createdById: userId, status: "pending", createdAt: { gte: new Date(now.getTime() - ASK_PICKUP_MS) } },
    orderBy: { createdAt: "asc" },
  });
  if (!ask) return null;
  const r = await prisma.clinicAsk.updateMany({ where: { id: ask.id, status: "pending" }, data: { status: "running" } });
  if (r.count === 0) return null;
  const [roadmaps, list] = await Promise.all([
    latestRoadmaps(userId, [ask.chartNo]),
    prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: userId, date: ask.visitDate } }, select: { rows: true } }),
  ]);
  const row = ((list?.rows ?? []) as OutpatientRow[]).find((x) => x.chartNo === ask.chartNo);
  return {
    id: ask.id,
    visitDate: ask.visitDate,
    chartNo: ask.chartNo,
    question: ask.question,
    visit: row?.visit ?? "",
    diagnosis: row?.diagnosis ?? "",
    roadmap: roadmaps.get(ask.chartNo)?.text ?? row?.roadmap ?? "",
    soap: row?.soap ?? "",
  };
}
