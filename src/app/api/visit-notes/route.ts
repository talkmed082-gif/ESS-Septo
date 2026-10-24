import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { findUserByImportToken } from "@/lib/import-auth";
import { VisitNoteBodySchema } from "@/lib/roadmap";
import { pendingVisitNotes, saveVisitNote } from "@/lib/roadmap-store";

// POST: 진료실 프로그램 [로드맵 저장] — 지금 열린 기록지 글을 그날 기록으로(같은 날 같은 환자는 덮어씀)
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = VisitNoteBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  return pcJson(await saveVisitNote(user.id, parsed.data));
}

// GET: 노트북 저녁 작업이 아직 반영 안 한 기록을 받아 간다(병원 PC 자동화 토큰만)
export async function GET(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  return pcJson({ notes: await pendingVisitNotes(user.id) });
}
