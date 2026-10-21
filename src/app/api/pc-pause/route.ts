import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { findPause, kstDate } from "@/lib/hospital-link";
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
