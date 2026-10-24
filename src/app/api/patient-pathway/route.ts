import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { SetStageSchema } from "@/lib/pathways";
import { setPatientStage } from "@/lib/pathway-store";

// POST: 진료실 프로그램의 갈림길 버튼 — 의사가 단계를 정함(확정)
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = SetStageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const r = await setPatientStage(user.id, parsed.data.chartNo, parsed.data.pathwayId, parsed.data.stageId);
  if (!r) return pcJson({ error: "경로는 환자당 2개까지입니다." }, { status: 400 });
  return pcJson({ ok: true });
}
