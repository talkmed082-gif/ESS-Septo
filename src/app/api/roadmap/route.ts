import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { findUserByImportToken } from "@/lib/import-auth";
import { RoadmapUpdateBodySchema } from "@/lib/roadmap";
import { applyVisitRoadmaps, latestRoadmaps } from "@/lib/roadmap-store";
import { prisma } from "@/lib/prisma";
import { patientRoadmaps } from "@/lib/pathway-store";
import { pathwayById, pathwayText, stageOf } from "@/lib/pathways";

// GET ?chartNo= : 진료실 프로그램이 지금 연 환자의 최신 로드맵을 보여 준다
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const chartNo = new URL(request.url).searchParams.get("chartNo") ?? "";
  if (!/^\d{4,12}$/.test(chartNo)) return pcJson({ error: "등록번호가 올바르지 않습니다." }, { status: 400 });
  const [r, care, pw] = await Promise.all([
    latestRoadmaps(user.id, [chartNo]).then((m) => m.get(chartNo)),
    prisma.patientCare.findUnique({
      where: { createdById_chartNo: { createdById: user.id, chartNo } },
      select: { planType: true, nextVisit: true, nextVisitLabel: true },
    }),
    patientRoadmaps(user.id, [chartNo]).then((m) => m.get(chartNo)),
  ]);
  // pathwayText: 진료 경로(단계·할 일·갈림길), visits: 외래별 요약
  const pathwayTextAll = (pw?.pathways ?? []).map(pathwayText).filter(Boolean).join("\n\n");
  return pcJson({
    ...(r ? { text: r.text, done: r.done, source: r.source, createdAt: r.createdAt.toISOString() } : { text: null }),
    care,
    pathwayText: pathwayTextAll || null,
    visits: pw?.visits ?? [],
    // 갈림길 버튼: 지금 단계의 선택지(to가 있는 것만) + 확정 전이면 "이 단계 확정"
    decisions: (pw?.pathways ?? []).flatMap((p) => {
      const def = pathwayById(p.pathwayId);
      const st = def && stageOf(def, p.stageId);
      if (!def || !st) return [];
      const opts = (st.decide?.options ?? []).filter((o) => o.to).map((o) => ({ label: o.label, to: o.to! }));
      if (!p.confirmed) opts.unshift({ label: "이 단계 확정", to: p.stageId });
      const prop = stageOf(def, p.proposedStageId);
      if (prop) opts.unshift({ label: `AI 제안 받기: ${prop.name}`, to: prop.id });
      return opts.map((o) => ({ pathwayId: p.pathwayId, ...o }));
    }),
  });
}

// POST: 노트북 저녁 작업이 진료 기록으로 갱신한 로드맵을 올린다(병원 PC 자동화 토큰만)
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = RoadmapUpdateBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  return pcJson(await applyVisitRoadmaps(user.id, parsed.data.items));
}
