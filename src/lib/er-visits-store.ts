import "server-only";
import { prisma } from "@/lib/prisma";
import { erDutyNames, erMyShifts, erNightStart, type ErNowRow, type ErOncallResult, type ErVisitItem } from "@/lib/er-visits";

// 그 당직일의 당직표(DutyRoster, 이름 = 계정 이름) — 담당의로 볼 동반당직자와 내 근무(일직·숙직)
export async function getErDuty(userId: string, date: string) {
  const [rows, user] = await Promise.all([
    prisma.dutyRoster.findMany({ where: { createdById: userId, date }, select: { date: true, name: true, kind: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  const me = user?.name ?? "";
  return { rows, dutyNames: erDutyNames(rows, date, me), myShifts: erMyShifts(rows, date, me), nightStart: erNightStart(rows, date, me) };
}

// 병원 PC가 10분마다 확인: "응급실 환자 가져오기" 요청(당직일·시각·담당의로 볼 동반당직자·숙직 시작 시각)과 저장할 온콜대장 신청(요청 순).
// 온콜일자는 PC가 arrivedAt(+15분 호출)로 정한다 — 숙직 새벽 환자는 당직일 다음 날
export async function getErRequest(userId: string) {
  const [user, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { erCheckDate: true, erCheckRequestedAt: true, erNowRequestedAt: true } }),
    prisma.erVisit.findMany({
      where: { createdById: userId, oncallStatus: "PENDING", oncallRequestedAt: { not: null } },
      orderBy: { oncallRequestedAt: "asc" },
      select: { id: true, date: true, chartNo: true, arrivedAt: true, call: true, arrive: true, end: true, oncallRequestedAt: true },
    }),
  ]);
  const date = user?.erCheckRequestedAt && user.erCheckDate ? user.erCheckDate : null;
  return {
    // 응급실 현황 [새로고침] 요청 시각(없으면 null) — PC가 er_now.ps1 -RequestedAt으로 처리
    nowRequestedAt: user?.erNowRequestedAt?.toISOString() ?? null,
    request: date
      ? await getErDuty(userId, date).then((d) => ({ date, requestedAt: user!.erCheckRequestedAt!.toISOString(), dutyNames: d.dutyNames, nightStart: d.nightStart }))
      : null,
    oncall: pending.map((v) => ({
      id: v.id,
      date: v.date,
      chartNo: v.chartNo,
      arrivedAt: v.arrivedAt ?? "",
      call: v.call ?? "",
      arrive: v.arrive ?? "",
      end: v.end ?? "",
      requestedAt: v.oncallRequestedAt!.toISOString(),
    })),
  };
}

// 그날 목록 반영. 이번 목록에 없는 환자는 지우되 온콜대장을 신청·저장한 것은 남긴다. 온콜 시각은 신청 전 것만 PC 제안으로 바꾼다.
// oncallSaved(온콜대장에 이미 줄이 있음 — 직접 넣었거나 저장됨)면 "입력 완료"로. 처리한 요청이 그대로면 요청을 비운다.
// error가 있으면 목록은 그대로 두고 요청만 비운다
export async function saveErVisits(
  userId: string,
  body: { date: string; items: ErVisitItem[]; requestedAt?: string; error?: string },
) {
  if (!body.error) {
    const keep = await prisma.erVisit.findMany({
      where: { createdById: userId, date: body.date, oncallStatus: { not: null } },
      select: { chartNo: true, oncallStatus: true },
    });
    const status = new Map(keep.map((k) => [k.chartNo, k.oncallStatus]));
    const now = new Date();
    await prisma.$transaction([
      prisma.erVisit.deleteMany({
        where: { createdById: userId, date: body.date, oncallStatus: null, chartNo: { notIn: body.items.map((i) => i.chartNo) } },
      }),
      ...body.items.map((item) => {
        const { oncallSaved, ...i } = item;
        const saved = oncallSaved && status.get(i.chartNo) !== "SAVED" ? { oncallStatus: "SAVED", oncallMessage: "온콜대장에 있음", oncallSavedAt: now } : {};
        const update = status.has(i.chartNo) ? { ...i, call: undefined, arrive: undefined, end: undefined } : i;
        return prisma.erVisit.upsert({
          where: { createdById_date_chartNo: { createdById: userId, date: body.date, chartNo: i.chartNo } },
          create: { ...i, ...saved, date: body.date, createdById: userId },
          update: { ...update, ...saved },
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

// 응급실 현황 반영 — 목록을 통째로 바꾼다(error면 그대로). 처리한 [새로고침] 요청이 그대로면 비운다
export async function saveErNow(userId: string, body: { rows: ErNowRow[]; requestedAt?: string; error?: string }) {
  if (!body.error) {
    await prisma.user.update({ where: { id: userId }, data: { erNowRows: body.rows, erNowAt: new Date() } });
  }
  if (body.requestedAt) {
    await prisma.user.updateMany({
      where: { id: userId, erNowRequestedAt: new Date(body.requestedAt) },
      data: { erNowRequestedAt: null },
    });
  }
  return { ok: true, count: body.rows.length };
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
