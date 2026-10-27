import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { NoteCleanupResultSchema, nextNoteState, parseNoteState } from "@/lib/note-cleanup";

// 외래 후 서명 전 기록지 정리(note-cleanup.ts) — 노트북(reminder_sync 10분 확인 → note_cleanup.ps1)이 쓴다.
// GET: 확인 요청(check)과 삭제 승인(deleteRequested) 일감 / POST: 결과
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const jobs = await prisma.opdJob.findMany({
    where: { createdById: user.id, OR: [{ noteState: "check" }, { noteState: { startsWith: "deleteRequested:" } }] },
    select: { id: true, chartNo: true, visitDate: true, noteState: true },
    orderBy: { visitDate: "asc" },
    take: 100,
  });
  const check = [], del = [];
  for (const j of jobs) {
    const s = parseNoteState(j.noteState);
    if (s.kind === "check") check.push({ id: j.id, chartNo: j.chartNo, visitDate: j.visitDate });
    if (s.kind === "deleteRequested") del.push({ id: j.id, chartNo: j.chartNo, visitDate: j.visitDate, noteId: s.noteId });
  }
  return pcJson({ check, delete: del });
}

export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = NoteCleanupResultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  let applied = 0;
  for (const r of parsed.data.results) {
    const job = await prisma.opdJob.findFirst({ where: { id: r.id, createdById: user.id }, select: { noteState: true } });
    if (!job) continue;
    const next = nextNoteState(job.noteState, r);
    if (next === null) continue;
    // 읽은 뒤 사용자가 바꿨으면 덮어쓰지 않음
    applied += (await prisma.opdJob.updateMany({ where: { id: r.id, createdById: user.id, noteState: job.noteState }, data: { noteState: next } })).count;
  }
  return pcJson({ ok: true, applied });
}
