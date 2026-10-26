import { NextResponse } from "next/server";
import * as z from "zod";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { latestRoadmaps, toggleRoadmapTodo } from "@/lib/roadmap-store";

// (404는 진료 어시스트가 "연결 끊김"으로 읽어서 400)
// POST { chartNo, item }: 진료 어시스트 [작성] 로드맵 할 일 체크/해제(2026-10-26) — 그 환자 최신 로드맵 판에. 결과 done 목록을 돌려준다
const Body = z.object({ chartNo: z.string().trim().regex(/^\d{4,12}$/), item: z.string().trim().min(1).max(200) });
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const { chartNo, item } = parsed.data;
  const rm = (await latestRoadmaps(user.id, [chartNo])).get(chartNo);
  if (!rm) return pcJson({ error: "이 환자 로드맵이 없습니다." }, { status: 400 });
  await toggleRoadmapTodo(user.id, rm.id, item);
  const after = (await latestRoadmaps(user.id, [chartNo])).get(chartNo);
  return pcJson({ ok: true, done: after?.done ?? [] });
}
