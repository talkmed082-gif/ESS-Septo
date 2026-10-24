import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { findUserByImportToken } from "@/lib/import-auth";
import { RoadmapUpdateBodySchema } from "@/lib/roadmap";
import { applyVisitRoadmaps, latestRoadmaps } from "@/lib/roadmap-store";

// GET ?chartNo= : 진료실 프로그램이 지금 연 환자의 최신 로드맵을 보여 준다
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const chartNo = new URL(request.url).searchParams.get("chartNo") ?? "";
  if (!/^\d{4,12}$/.test(chartNo)) return pcJson({ error: "등록번호가 올바르지 않습니다." }, { status: 400 });
  const r = (await latestRoadmaps(user.id, [chartNo])).get(chartNo);
  return pcJson(r ? { text: r.text, done: r.done, source: r.source, createdAt: r.createdAt.toISOString() } : { text: null });
}

// POST: 노트북 저녁 작업이 진료 기록으로 갱신한 로드맵을 올린다(병원 PC 자동화 토큰만)
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = RoadmapUpdateBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  return pcJson(await applyVisitRoadmaps(user.id, parsed.data.items));
}
