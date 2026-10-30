import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { prisma } from "@/lib/prisma";
import { DutyRosterBodySchema } from "@/lib/duty-roster";

// 병원 PC가 이비인후과 의사 당직표(이번 달·다음 달)를 올리는 입구. 올린 기간은 통째로 바꾼다(바뀐 당직이 남지 않게)
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const parsed = DutyRosterBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const { from, to, items } = parsed.data;

  await prisma.$transaction([
    prisma.dutyRoster.deleteMany({ where: { createdById: user.id, date: { gte: from, lte: to } } }),
    prisma.dutyRoster.createMany({
      data: items.map((i) => ({ ...i, createdById: user.id })),
      skipDuplicates: true,
    }),
  ]);
  return pcJson({ ok: true, count: items.length });
}
