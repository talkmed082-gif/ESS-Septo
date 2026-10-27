import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { prisma } from "@/lib/prisma";
import { CpapUploadSchema } from "@/lib/cpap";

// POST: 노트북이 외래 기록에서 찾은 양압기 정보(회사 약자·설정·처방)를 환자별로 올린다(CPAP F/U 환자 탭, 2026-10-27)
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = CpapUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  for (const it of parsed.data.items) {
    await prisma.patientCare.upsert({
      where: { createdById_chartNo: { createdById: user.id, chartNo: it.chartNo } },
      create: { createdById: user.id, chartNo: it.chartNo, cpap: it.cpap },
      update: { cpap: it.cpap },
    });
  }
  return pcJson({ ok: true, count: parsed.data.items.length });
}
