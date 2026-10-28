import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcsFeed } from "@/lib/calendar";
import { isCalendarTokenFormat } from "@/lib/calendar-feed";
import { deptRowToEvents } from "@/lib/dept-calendar-feed";
import { kstDate } from "@/lib/hospital-link";

const FEED_LOOKBACK_DAYS = 90;

// 비과 전체 일정 구독 피드(사용자 2026-10-28) — 계정 없는 선생님께도 주소만 건네면 되게 로그인 없이 읽는다.
// 주소의 비밀 토큰이 곧 인증(개인 수술 피드 /api/calendar/[token]과 같은 방식). 틀리면 똑같이 404.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isCalendarTokenFormat(token)) return notFound();

  const owner = await prisma.user.findUnique({ where: { deptCalendarToken: token }, select: { id: true } });
  if (!owner) return notFound();

  const rows = await prisma.profSchedule.findMany({
    where: { createdById: owner.id, date: { gte: kstDate(new Date(), -FEED_LOOKBACK_DAYS) } },
    orderBy: { date: "asc" },
    select: { date: true, doctor: true, outpatient: true, outpatientAm: true, outpatientPm: true, surgeries: true, off: true, updatedAt: true },
  });

  const ics = buildIcsFeed({ calendarName: "비과 일정", events: rows.flatMap(deptRowToEvents) });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="rhinology.ics"',
      "Cache-Control": "private, no-cache",
    },
  });
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}
