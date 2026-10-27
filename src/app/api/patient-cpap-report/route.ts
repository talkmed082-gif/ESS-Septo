import { NextResponse } from "next/server";
import * as z from "zod";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { prisma } from "@/lib/prisma";
import { CpapSchema } from "@/lib/cpap";

// POST: 이 PC가 J:\내 드라이브\CPAP의 회사 결과(데이터 PDF·보고서 hwp)를 읽어 올린다(2026-10-27).
// 파일 이름 앞의 환자 이름 = 그 환자 PatientCare.cpap.realName(CPAP 환자만 실명이 있음). 못 맞춘 이름은 unmatched로 돌려줌
const Body = z.object({
  items: z.array(z.object({ name: z.string().trim().min(1).max(30), text: z.string().max(1500), expiry: z.string().max(20).nullable(), kind: z.string().max(40).nullable() })).max(50),
});

export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const cares = (await prisma.patientCare.findMany({ where: { createdById: user.id }, select: { chartNo: true, cpap: true } })).flatMap((c) => {
    const p = CpapSchema.safeParse(c.cpap);
    return p.success && c.cpap && p.data.realName ? [{ chartNo: c.chartNo, cpap: p.data }] : [];
  });
  const at = new Date().toISOString();
  const matched: string[] = [], unmatched: string[] = [];
  for (const it of parsed.data.items) {
    const hits = cares.filter((c) => c.cpap.realName === it.name);
    if (hits.length !== 1) { unmatched.push(it.name); continue; }   // 같은 이름 둘 이상이면 넣지 않음
    const c = hits[0];
    await prisma.patientCare.update({
      where: { createdById_chartNo: { createdById: user.id, chartNo: c.chartNo } },
      data: { cpap: { ...c.cpap, report: { text: it.text, expiry: it.expiry, kind: it.kind, at } } },
    });
    matched.push(it.name);
  }
  return pcJson({ ok: true, matched: matched.length, unmatched });
}
