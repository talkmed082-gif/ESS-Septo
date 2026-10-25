import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { prisma } from "@/lib/prisma";
import { ProfScheduleBodySchema } from "@/lib/prof-schedule";

// 병원 PC가 교수님별 외래 인원·수술(앞으로 2주)을 올리는 입구. 올린 기간은 통째로 바꾼다(취소된 수술이 남지 않게)
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const parsed = ProfScheduleBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const { from, to, items } = parsed.data;

  await prisma.$transaction([
    prisma.profSchedule.deleteMany({ where: { createdById: user.id, date: { gte: from, lte: to } } }),
    prisma.profSchedule.createMany({
      data: items.map((i) => ({ ...i, createdById: user.id })),
      skipDuplicates: true,
    }),
  ]);
  return pcJson({ ok: true, count: items.length });
}
