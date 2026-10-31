import "server-only";
import { prisma } from "@/lib/prisma";
import { erDutyNames, type ErOncallResult, type ErVisitItem } from "@/lib/er-visits";

function dayBefore(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// 그날(+전날 숙직) 이비인후과 당직자 — 당직표(DutyRoster, 이름 = 계정 이름)에서. 나는 뺀다
export async function getErDutyNames(userId: string, date: string) {
  const [rows, user] = await Promise.all([
    prisma.dutyRoster.findMany({
      where: { createdById: userId, date: { in: [dayBefore(date), date] } },
      select: { date: true, name: true, kind: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  return erDutyNames(rows, date, user?.name ?? "");
}

// 병원 PC가 10분마다 확인: "응급실 환자 가져오기" 요청(날짜·시각·담당의로 볼 동반당직자)과 저장할 온콜대장 신청(요청 순)
export async function getErRequest(userId: string) {
  const [user, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { erCheckDate: true, erCheckRequestedAt: true } }),
    prisma.erVisit.findMany({
      where: { createdById: userId, oncallStatus: "PENDING", oncallRequestedAt: { not: null } },
      orderBy: { oncallRequestedAt: "asc" },
      select: { id: true, date: true, chartNo: true, call: true, arrive: true, end: true, oncallRequestedAt: true },
    }),
  ]);
  const date = user?.erCheckRequestedAt && user.erCheckDate ? user.erCheckDate : null;
  return {
    request: date
      ? { date, requestedAt: user!.erCheckRequestedAt!.toISOString(), dutyNames: await getErDutyNames(userId, date) }
      : null,
    oncall: pending.map((v) => ({
      id: v.id,
      date: v.date,
      chartNo: v.chartNo,
      call: v.call ?? "",
      arrive: v.arrive ?? "",
      end: v.end ?? "",
      requestedAt: v.oncallRequestedAt!.toISOString(),
    })),
  };
}

// 그날 목록 반영. 이번 목록에 없는 환자는 지우되 온콜대장을 신청·저장한 것은 남긴다. 온콜 시각은 신청 전 것만 PC 제안으로 바꾼다.
// 처리한 요청이 그대로면 요청을 비운다. error가 있으면 목록은 그대로 두고 요청만 비운다
export async function saveErVisits(
  userId: string,
  body: { date: string; items: ErVisitItem[]; requestedAt?: string; error?: string },
) {
  if (!body.error) {
    const keep = await prisma.erVisit.findMany({
      where: { createdById: userId, date: body.date, oncallStatus: { not: null } },
      select: { chartNo: true },
    });
    const locked = new Set(keep.map((k) => k.chartNo));
    await prisma.$transaction([
      prisma.erVisit.deleteMany({
        where: { createdById: userId, date: body.date, oncallStatus: null, chartNo: { notIn: body.items.map((i) => i.chartNo) } },
      }),
      ...body.items.map((i) => {
        const update = locked.has(i.chartNo) ? { ...i, call: undefined, arrive: undefined, end: undefined } : i;
        return prisma.erVisit.upsert({
          where: { createdById_date_chartNo: { createdById: userId, date: body.date, chartNo: i.chartNo } },
          create: { ...i, date: body.date, createdById: userId },
          update,
        });
      }),
    ]);
  }
  if (body.requestedAt) {
    await prisma.user.updateMany({
      where: { id: userId, erCheckRequestedAt: new Date(body.requestedAt) },
      data: { erCheckRequestedAt: null },
    });
  }
  return { ok: true, count: body.items.length };
}

// 온콜대장 저장 결과 — 처리한 신청이 그대로일 때만(그 사이 취소·다시 신청했으면 무시)
export async function recordErOncall(userId: string, body: ErOncallResult) {
  const r = await prisma.erVisit.updateMany({
    where: { id: body.id, createdById: userId, oncallStatus: "PENDING", oncallRequestedAt: new Date(body.requestedAt) },
    data: body.ok
      ? { oncallStatus: "SAVED", oncallMessage: body.message ?? null, oncallSavedAt: new Date() }
      : { oncallStatus: "FAILED", oncallMessage: body.message ?? null },
  });
  return { ok: true, updated: r.count };
}
