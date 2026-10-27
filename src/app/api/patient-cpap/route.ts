import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { prisma } from "@/lib/prisma";
import { CpapSchema, CpapUploadSchema } from "@/lib/cpap";

// POST: 노트북이 외래 기록에서 찾은 양압기 정보(회사 약자·설정·처방)를 환자별로 올린다(CPAP F/U 환자 탭, 2026-10-27)
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = CpapUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  for (const it of parsed.data.items) {
    // 메일 확인 결과(mail)는 사이트가 채운 것 — 노트북이 다시 올려도 지우지 않는다
    const old = await prisma.patientCare.findUnique({ where: { createdById_chartNo: { createdById: user.id, chartNo: it.chartNo } }, select: { cpap: true } });
    const prev = CpapSchema.safeParse(old?.cpap ?? null);
    const p = prev.success ? prev.data : null;
    // 사이트·이 PC가 채운 것(메일 확인·회사 결과)과 실명·PSG AHI는 노트북이 비워 보내도 지우지 않는다
    const cpap = { ...it.cpap, mail: it.cpap.mail ?? p?.mail ?? null, report: it.cpap.report ?? p?.report ?? null, realName: it.cpap.realName ?? p?.realName ?? null, psgAhi: it.cpap.psgAhi ?? p?.psgAhi ?? null };
    await prisma.patientCare.upsert({
      where: { createdById_chartNo: { createdById: user.id, chartNo: it.chartNo } },
      create: { createdById: user.id, chartNo: it.chartNo, cpap },
      update: { cpap },
    });
  }
  return pcJson({ ok: true, count: parsed.data.items.length });
}
