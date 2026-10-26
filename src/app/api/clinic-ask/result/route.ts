import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { ClinicAskResultSchema } from "@/lib/clinic-ask";

// POST: 노트북 작업자가 [Claude에게 묻기] 답을 올린다(ok=false면 실패 이유가 answer)
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = ClinicAskResultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const { id, ok, answer } = parsed.data;
  const r = await prisma.clinicAsk.updateMany({
    where: { id, createdById: user.id, status: "running" },
    data: { status: ok ? "done" : "failed", answer: answer.trim() || (ok ? "(빈 답)" : "실패"), answeredAt: new Date() },
  });
  return pcJson({ ok: r.count > 0 });
}
