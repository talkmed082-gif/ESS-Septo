import "server-only";
import { prisma } from "@/lib/prisma";
import { kstDate } from "@/lib/hospital-link";
import { applyProposal, parseHistory, planOfStage, pushHistory, type PathwayProposal, type StageEvent, type VisitLine } from "@/lib/pathways";

export type PatientPathwayView = {
  pathwayId: string;
  stageId: string;
  confirmed: boolean;
  proposedStageId: string | null;
  proposedReason: string | null;
  startedAt: string;
  history: StageEvent[];
};
export type VisitSummaryView = { visitDate: string; summary: string; pathwayId: string | null; stageId: string | null };

// AI가 고른 경로·단계와 외래별 요약을 저장한다(로드맵 글에서 뗀 줄). 경로는 환자당 2개까지
export async function applyPathwayLines(userId: string, chartNo: string, pathways: PathwayProposal[], visits: VisitLine[]) {
  const today = kstDate(new Date());
  const existing = await prisma.patientPathway.findMany({ where: { createdById: userId, chartNo } });
  for (const prop of pathways) {
    const cur = existing.find((e) => e.pathwayId === prop.pathwayId);
    if (!cur && existing.length >= 2) continue;
    const next = applyProposal(cur ? { stageId: cur.stageId, confirmed: cur.confirmed, history: parseHistory(cur.history) } : null, prop, today);
    if (cur) await prisma.patientPathway.update({ where: { id: cur.id }, data: next });
    else {
      const created = await prisma.patientPathway.create({ data: { ...next, chartNo, pathwayId: prop.pathwayId, startedAt: visits[0]?.date ?? today, createdById: userId } });
      existing.push(created);
    }
  }
  for (const v of visits)
    await prisma.visitSummary.upsert({
      where: { createdById_chartNo_visitDate: { createdById: userId, chartNo, visitDate: v.date } },
      create: { chartNo, visitDate: v.date, summary: v.summary, pathwayId: v.pathwayId, stageId: v.stageId, createdById: userId },
      update: { summary: v.summary, pathwayId: v.pathwayId, stageId: v.stageId },
    });
}

export async function patientRoadmaps(userId: string, chartNos: string[]) {
  const map = new Map<string, { pathways: PatientPathwayView[]; visits: VisitSummaryView[] }>();
  if (!chartNos.length) return map;
  const [pws, vs] = await Promise.all([
    prisma.patientPathway.findMany({ where: { createdById: userId, chartNo: { in: chartNos } }, orderBy: { startedAt: "asc" } }),
    prisma.visitSummary.findMany({ where: { createdById: userId, chartNo: { in: chartNos } }, orderBy: { visitDate: "asc" } }),
  ]);
  const get = (c: string) => map.get(c) ?? (map.set(c, { pathways: [], visits: [] }), map.get(c)!);
  for (const p of pws)
    get(p.chartNo).pathways.push({
      pathwayId: p.pathwayId, stageId: p.stageId, confirmed: p.confirmed, proposedStageId: p.proposedStageId,
      proposedReason: p.proposedReason, startedAt: p.startedAt, history: parseHistory(p.history),
    });
  for (const v of vs) get(v.chartNo).visits.push({ visitDate: v.visitDate, summary: v.summary, pathwayId: v.pathwayId, stageId: v.stageId });
  return map;
}

// 의사가 단계를 정함(확정). 경로가 없으면 새로 시작(2개까지). 그 단계에 맞는 Plan도 같이 저장
export async function setPatientStage(userId: string, chartNo: string, pathwayId: string, stageId: string) {
  const r = await setStageOnly(userId, chartNo, pathwayId, stageId);
  const plan = planOfStage(stageId);
  if (r && plan)
    await prisma.patientCare.upsert({
      where: { createdById_chartNo: { createdById: userId, chartNo } },
      create: { chartNo, planType: plan, createdById: userId },
      update: { planType: plan },
    });
  return r;
}

async function setStageOnly(userId: string, chartNo: string, pathwayId: string, stageId: string) {
  const today = kstDate(new Date());
  const cur = await prisma.patientPathway.findUnique({ where: { createdById_chartNo_pathwayId: { createdById: userId, chartNo, pathwayId } } });
  const ev: StageEvent = { stageId, date: today, by: "doctor" };
  if (cur)
    return prisma.patientPathway.update({
      where: { id: cur.id },
      data: { stageId, confirmed: true, proposedStageId: null, proposedReason: null, history: pushHistory(parseHistory(cur.history), ev) },
    });
  if ((await prisma.patientPathway.count({ where: { createdById: userId, chartNo } })) >= 2) return null;
  return prisma.patientPathway.create({ data: { chartNo, pathwayId, stageId, confirmed: true, startedAt: today, history: [ev], createdById: userId } });
}

export async function removePatientPathway(userId: string, chartNo: string, pathwayId: string) {
  await prisma.patientPathway.deleteMany({ where: { createdById: userId, chartNo, pathwayId } });
}
