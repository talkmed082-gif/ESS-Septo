import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { OpdJobResultSchema } from "@/lib/opd-jobs";

// POST: 노트북 작업자가 일감 결과를 올린다(done / failed / waiting = 나중에 다시)
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = OpdJobResultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const r = await prisma.opdJob.updateMany({ where: { id: parsed.data.id, createdById: user.id }, data: { status: parsed.data.status, result: parsed.data.result } });
  return pcJson({ ok: r.count > 0 });
}
