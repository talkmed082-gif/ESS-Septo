import { NextResponse } from "next/server";
import * as z from "zod";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { AutomationPauseSchema, findPause, kstDate, YES_PAUSE_PREFIX } from "@/lib/hospital-link";
import { prisma } from "@/lib/prisma";

// 병원 PC가 작업을 시작할 때 "오늘(?date=yyyy-MM-dd, 없으면 서울 오늘) 자동화 쉬는 날인지" 묻는 입구
export async function GET(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const q = new URL(request.url).searchParams.get("date");
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : kstDate(new Date());
  const pauses = await prisma.automationPause.findMany({
    where: { createdById: user.id, from: { lte: date }, to: { gte: date } },
    select: { from: true, to: true, note: true },
  });
  const p = findPause(pauses, date);
  return pcJson({ date, paused: !!p, from: p?.from ?? null, to: p?.to ?? null, note: p?.note ?? null });
}

const YesPauseBodySchema = z.object({ items: z.array(AutomationPauseSchema).max(60) });

// 병원 PC가 YES(부서행정 → 교수근무변동조회)에서 읽은 출장·휴가를 올리는 입구.
// 끝나지 않은 YES 일정([YES] 메모)을 지우고 받은 것으로 바꾼다 — YES에서 취소하면 여기서도 빠진다. 직접 넣은 쉬는 날은 그대로.
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const parsed = YesPauseBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  const today = kstDate(new Date());
  const items = parsed.data.items.filter((i) => i.to >= today);
  await prisma.$transaction([
    prisma.automationPause.deleteMany({
      where: { createdById: user.id, note: { startsWith: YES_PAUSE_PREFIX }, to: { gte: today } },
    }),
    prisma.automationPause.createMany({
      data: items.map((i) => ({
        from: i.from,
        to: i.to,
        note: `${YES_PAUSE_PREFIX} ${i.note ?? ""}`.trim(),
        createdById: user.id,
      })),
    }),
  ]);
  return pcJson({ ok: true, count: items.length });
}
