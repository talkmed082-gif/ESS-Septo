import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcsFeed } from "@/lib/calendar";
import { isCalendarTokenFormat, planToCalendarEvent } from "@/lib/calendar-feed";

const FEED_LOOKBACK_DAYS = 90;

// 구글 캘린더 "URL로 추가"가 로그인 없이 읽어가는 구독 피드 — 주소에 든 비밀
// 토큰이 곧 인증이다(/api 경로는 proxy 로그인 검사 대상이 아니다). 토큰이
// 없거나 틀리면 어떤 정보도 알려주지 않도록 똑같이 404로 답한다.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isCalendarTokenFormat(token)) return notFound();

  const owner = await prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true } });
  if (!owner) return notFound();

  const since = new Date(Date.now() - FEED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const plans = await prisma.opPlan.findMany({
    where: { createdById: owner.id, plannedDate: { gte: since } },
    orderBy: { plannedDate: "asc" },
    include: { surgeryType: true },
  });

  const ics = buildIcsFeed({
    calendarName: "수술 일정",
    events: plans.map((plan) => planToCalendarEvent({ ...plan, plannedDate: plan.plannedDate! })),
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="op-plans.ics"',
      "Cache-Control": "private, no-cache",
    },
  });
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}
