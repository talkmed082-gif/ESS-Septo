import "server-only";
import { prisma } from "@/lib/prisma";
import { kstDate } from "@/lib/hospital-link";
import { carryDone, parseDone } from "@/lib/roadmap";

// 등록번호별 최신 로드맵
export async function latestRoadmaps(userId: string, chartNos: string[]) {
  if (!chartNos.length) return new Map<string, { id: string; text: string; done: string[]; source: string; createdAt: Date }>();
  const rows = await prisma.roadmapVersion.findMany({
    where: { createdById: userId, chartNo: { in: chartNos } },
    orderBy: { createdAt: "desc" },
    select: { id: true, chartNo: true, text: true, done: true, source: true, createdAt: true },
  });
  const map = new Map<string, { id: string; text: string; done: string[]; source: string; createdAt: Date }>();
  for (const r of rows) if (!map.has(r.chartNo)) map.set(r.chartNo, { ...r, done: parseDone(r.done) });
  return map;
}

// 새 판을 쌓는다. 최신 판과 글이 같으면 쌓지 않음. 체크한 할 일은 같은 글이면 이어 간다
export async function addRoadmapVersion(userId: string, chartNo: string, text: string, source: "soap" | "visit") {
  const latest = (await latestRoadmaps(userId, [chartNo])).get(chartNo);
  if (latest && latest.text === text) return false;
  await prisma.roadmapVersion.create({
    data: { chartNo, text, source, done: latest ? carryDone(latest.done, text) : [], createdById: userId },
  });
  return true;
}

// 진료실 프로그램 [로드맵 저장]: 그날(서울) 같은 환자는 덮어씀
export async function saveVisitNote(userId: string, body: { chartNo: string; kind: string; text: string }) {
  const visitDate = kstDate(new Date());
  await prisma.visitNote.upsert({
    where: { createdById_chartNo_visitDate: { createdById: userId, chartNo: body.chartNo, visitDate } },
    create: { ...body, visitDate, createdById: userId },
    update: { kind: body.kind, text: body.text, processedAt: null },
  });
  return { ok: true, visitDate };
}

// 노트북 저녁 작업: 아직 로드맵에 반영 안 한 기록 + 그 환자의 지금 로드맵
export async function pendingVisitNotes(userId: string) {
  const notes = await prisma.visitNote.findMany({
    where: { createdById: userId, processedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, chartNo: true, visitDate: true, kind: true, text: true },
    take: 200,
  });
  const charts = [...new Set(notes.map((n) => n.chartNo))];
  const [latest, cares] = await Promise.all([
    latestRoadmaps(userId, charts),
    prisma.patientCare.findMany({ where: { createdById: userId, chartNo: { in: charts } }, select: { chartNo: true, planType: true, nextVisit: true } }),
  ]);
  const care = new Map(cares.map((c) => [c.chartNo, c]));
  return notes.map((n) => ({
    ...n,
    roadmap: latest.get(n.chartNo)?.text ?? null,
    done: latest.get(n.chartNo)?.done ?? [],
    planType: care.get(n.chartNo)?.planType ?? null,
    nextVisit: care.get(n.chartNo)?.nextVisit ?? null,
  }));
}

export async function applyVisitRoadmaps(userId: string, items: { chartNo: string; text: string; noteIds: string[] }[]) {
  let added = 0;
  for (const i of items) if (await addRoadmapVersion(userId, i.chartNo, i.text, "visit")) added++;
  const ids = items.flatMap((i) => i.noteIds);
  const marked = ids.length
    ? (await prisma.visitNote.updateMany({ where: { createdById: userId, id: { in: ids } }, data: { processedAt: new Date() } })).count
    : 0;
  return { added, marked };
}

// 사이트에서 할 일 체크/해제(본인 것만)
export async function toggleRoadmapTodo(userId: string, versionId: string, item: string) {
  const v = await prisma.roadmapVersion.findFirst({ where: { id: versionId, createdById: userId }, select: { done: true } });
  if (!v) return;
  const done = parseDone(v.done);
  const next = done.includes(item) ? done.filter((d) => d !== item) : [...done, item];
  await prisma.roadmapVersion.update({ where: { id: versionId }, data: { done: next } });
}
