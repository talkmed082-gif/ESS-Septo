import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCalendarTokenFormat } from "@/lib/calendar-feed";

// 아이폰 단축어 — 타과의뢰 문자가 오면 부른다(사용자 2026-10-26). Authorization: Bearer <consultTriggerToken>.
// 하는 일은 [EMR에서 가져오기] 버튼과 같다(요청 시각만 남김 → 병원 PC가 10분 확인 때 목록을 올리고 비움).
// 문자 내용은 받지 않는다. 이미 대기 중인 요청이 있으면 그대로 둔다
export async function POST(request: Request) {
  const token = /^Bearer\s+(\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!isCalendarTokenFormat(token)) return new NextResponse("Not found", { status: 404 });
  const user = await prisma.user.findUnique({ where: { consultTriggerToken: token }, select: { id: true } });
  if (!user) return new NextResponse("Not found", { status: 404 });
  await prisma.user.updateMany({ where: { id: user.id, consultCheckRequestedAt: null }, data: { consultCheckRequestedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
