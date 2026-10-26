import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { WORKER_DEFAULT, WorkerHoursSchema } from "@/lib/clinic-ask";

// 노트북 작업자 작업 시간 — GET: 노트북 worker.ps1·작업자(10분마다)·진료 어시스트 [설정]이 읽음, POST: [설정]에서 저장
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { workerFrom: true, workerUntil: true } });
  return pcJson({ from: u?.workerFrom ?? WORKER_DEFAULT.from, until: u?.workerUntil ?? WORKER_DEFAULT.until });
}

export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = WorkerHoursSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: parsed.error.issues[0]?.message ?? "형식이 올바르지 않습니다." }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { workerFrom: parsed.data.from, workerUntil: parsed.data.until } });
  return pcJson({ ok: true, ...parsed.data });
}
