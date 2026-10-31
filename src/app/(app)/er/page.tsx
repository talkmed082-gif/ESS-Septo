import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buttonStyles } from "@/lib/ui";
import { seoulNow } from "@/lib/date-format";
import { isYmd } from "@/lib/er-visits";
import { myDutyDays } from "@/lib/duty-roster";
import { getErDutyNames } from "@/lib/er-visits-store";
import { cancelErCheck, cancelErOncall, requestErCheck } from "@/app/actions/er-visits";
import { AutoRefresh } from "../consults/auto-refresh";
import { OncallForm } from "./oncall-form";

// 응급실 — 그날 응급실에서 내가 본 환자(담당의가 이비인후과 동반당직자 + 내 응급 기록지)와 온콜대장 신청(사용자 2026-10-31)
const fmtTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type VisitRow = Awaited<ReturnType<typeof prisma.erVisit.findMany>>[number];

export default async function ErPage({ searchParams }: PageProps<"/er">) {
  const { userId } = await verifySession();
  const { date: dateParam } = await searchParams;
  const date = typeof dateParam === "string" && isYmd(dateParam) ? dateParam : seoulNow().date;
  const [visits, user, job, roster, dutyNames] = await Promise.all([
    prisma.erVisit.findMany({ where: { createdById: userId, date }, orderBy: { arrivedAt: "asc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, erCheckDate: true, erCheckRequestedAt: true } }),
    prisma.pcJobStatus.findUnique({ where: { createdById_job: { createdById: userId, job: "ER_VISITS" } } }),
    prisma.dutyRoster.findMany({ where: { createdById: userId, date }, select: { date: true, name: true, kind: true } }),
    getErDutyNames(userId, date),
  ]);
  const myDay = myDutyDays(roster, user?.name ?? "").get(date);

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <section className="space-y-2">
        <p className="text-sm text-slate-500">
          YES 응급실재원환자 현황에서 그날 응급실 환자 중 담당의가 이비인후과 당직자(그날 당직 + 전날 숙직, 캘린더 당직표)인 환자만 보고, 내
          응급 기록지가 있는 환자를 가져옵니다. 병원 PC가 10분 안에 처리합니다. [온콜대장 신청]을 누른 환자만 부서행정 온콜대장에 저장합니다.
        </p>
        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="rounded-md border border-slate-300 px-2 py-1 focus:border-slate-500 focus:outline-none"
          />
          <button type="submit" className={buttonStyles.smallOutline}>
            보기
          </button>
        </form>
        <p className="text-sm text-slate-700">
          {myDay ? (
            <>
              내 당직 {myDay.mine.join("·")} · 동반당직:{" "}
              {myDay.mates.length ? myDay.mates.map((m) => `${m.name}(${m.kinds.join("·")})`).join(", ") : "없음"}
            </>
          ) : (
            "이날 내 당직 없음(당직표 기준)"
          )}
        </p>
        <p className="text-xs text-slate-400">담당의로 찾는 당직자: {dutyNames.length ? dutyNames.join(", ") : "당직표에 없음 — 진료과 이비인후과 환자만 봅니다"}</p>
        {user?.erCheckRequestedAt ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <span>
              {user.erCheckDate} 가져오기 — {fmtTime.format(user.erCheckRequestedAt)}에 요청, 처리 대기
            </span>
            <form action={cancelErCheck}>
              <button type="submit" className={buttonStyles.smallOutline}>
                요청 취소
              </button>
            </form>
          </div>
        ) : (
          <form action={requestErCheck}>
            <input type="hidden" name="date" value={date} />
            <button type="submit" className={buttonStyles.primarySmall}>
              {date} 응급실 환자 가져오기
            </button>
          </form>
        )}
        {job && (
          <p className={`text-xs ${job.lastOk ? "text-slate-400" : "text-red-600"}`}>
            마지막 가져오기 {fmtTime.format(job.lastRunAt)}
            {job.lastMessage ? ` · ${job.lastMessage}` : ""}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {date} 내가 본 응급실 환자 ({visits.length}명)
        </h2>
        {visits.length === 0 && <p className="text-sm text-slate-400">가져온 환자가 없습니다.</p>}
        {visits.map((v) => (
          <VisitCard key={v.id} v={v} />
        ))}
      </section>
    </div>
  );
}

function VisitCard({ v }: { v: VisitRow }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-slate-900">{v.arrivedAt}</span>
        <span className="text-slate-400">·</span>
        <span>
          {v.patientName} {v.chartNo} {v.sexAge}
        </span>
        {v.dept && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{v.dept}</span>}
      </div>
      <p className="mt-1 text-slate-700">
        {v.complaint}
        {v.resident && <span className="text-slate-500"> · 담당의 {v.resident}</span>}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {v.dischargedAt ? `퇴실 ${v.dischargedAt} ${v.result ?? ""}` : "재실 중"}
        {v.notes && ` · 내 기록지 ${v.notes}`}
      </p>
      <OncallPart v={v} />
    </article>
  );
}

function OncallPart({ v }: { v: VisitRow }) {
  const times = `호출 ${v.call} · 도착 ${v.arrive} · 종료 ${v.end}`;
  if (v.oncallStatus === "SAVED") {
    return (
      <p className="mt-3 border-t border-slate-100 pt-2 text-sm">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">온콜대장 저장됨</span>
        <span className="ml-2 text-xs text-slate-500">
          {v.oncallMessage ?? times}
          {v.oncallSavedAt && ` · ${fmtTime.format(v.oncallSavedAt)}`}
        </span>
      </p>
    );
  }
  if (v.oncallStatus === "PENDING") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-sm">
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">온콜대장 저장 대기</span>
        <span className="text-xs text-slate-500">
          {times}
          {v.oncallRequestedAt && ` · ${fmtTime.format(v.oncallRequestedAt)}에 신청`}
        </span>
        <form action={cancelErOncall}>
          <input type="hidden" name="id" value={v.id} />
          <button type="submit" className={buttonStyles.smallOutline}>
            신청 취소
          </button>
        </form>
      </div>
    );
  }
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      {v.oncallStatus === "FAILED" && (
        <p className="text-sm text-red-600">온콜대장 저장 실패: {v.oncallMessage ?? "이유 모름"} — 고쳐서 다시 신청하거나 부서행정에서 직접 넣으세요</p>
      )}
      <OncallForm id={v.id} call={v.call ?? ""} arrive={v.arrive ?? ""} end={v.end ?? ""} />
    </div>
  );
}
