import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buttonStyles } from "@/lib/ui";
import { OUTPATIENT_TABS, SectionTabs } from "@/components/section-tabs";
import { cancelConsultCheck, cancelConsultReply, requestConsultCheck } from "@/app/actions/hospital-link";
import { ConsultReplyForm } from "./consult-reply-form";

// 외래 > 타과의뢰 — 병원 PC가 올린 EMR 타과의뢰(본인에게 온 것, 최근 30일). 회신을 쓰면 병원 PC가 EMR에 저장까지(서명은 EMR 일괄서명).
const fmtTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type ConsultRow = Awaited<ReturnType<typeof loadConsults>>[number];

function loadConsults(userId: string) {
  return prisma.consult.findMany({ where: { createdById: userId }, orderBy: { requestedAt: "desc" } });
}

export default async function ConsultsPage() {
  const { userId } = await verifySession();
  const [consults, user, job] = await Promise.all([
    loadConsults(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { consultCheckRequestedAt: true } }),
    prisma.pcJobStatus.findUnique({ where: { createdById_job: { createdById: userId, job: "CONSULT" } } }),
  ]);
  const open = consults.filter((c) => !c.replied);
  const done = consults.filter((c) => c.replied);

  return (
    <div className="space-y-6">
      <SectionTabs tabs={OUTPATIENT_TABS} current="/consults" />

      <section className="space-y-2">
        <p className="text-sm text-slate-500">
          EMR에서 본인에게 온 타과의뢰(최근 30일)를 가져옵니다. 회신을 쓰면 EMR 회신 기록지에 저장까지 합니다. 병원
          PC가 평일 8시~20시 사이 10분마다 확인해 처리합니다. 서명은 EMR에서 직접 하세요.
        </p>
        {user?.consultCheckRequestedAt ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <span>{fmtTime.format(user.consultCheckRequestedAt)}에 요청, 처리 대기</span>
            <form action={cancelConsultCheck}>
              <button type="submit" className={buttonStyles.smallOutline}>
                요청 취소
              </button>
            </form>
          </div>
        ) : (
          <form action={requestConsultCheck}>
            <button type="submit" className={buttonStyles.primarySmall}>
              EMR에서 가져오기
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
        <h2 className="text-sm font-semibold text-slate-700">미회신 ({open.length}건)</h2>
        {open.length === 0 && <p className="text-sm text-slate-400">미회신 타과의뢰가 없습니다.</p>}
        {open.map((c) => (
          <ConsultCard key={c.id} c={c} />
        ))}
      </section>

      {done.length > 0 && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">회신함 ({done.length}건)</summary>
          <div className="mt-3 space-y-3">
            {done.map((c) => (
              <ConsultCard key={c.id} c={c} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ConsultCard({ c }: { c: ConsultRow }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {c.emergency && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">응급</span>}
        <span className="font-medium text-slate-900">{c.requestedAt}</span>
        <span className="text-slate-400">·</span>
        <span>
          {c.fromDept} {c.fromDoctor}
        </span>
        {c.replied && <span className="text-xs text-slate-400">회신 {c.repliedAt}</span>}
      </div>
      <p className="mt-1 text-slate-700">
        {c.patientName} {c.chartNo} {c.sexAge} {c.location && <span className="text-slate-500">· {c.location}</span>}
      </p>
      {c.diagnosis && <p className="mt-2 text-slate-600">진단: {c.diagnosis}</p>}
      {c.content && <p className="mt-2 whitespace-pre-wrap text-slate-900">{c.content}</p>}
      <ReplyPart c={c} />
    </article>
  );
}

// 회신: 대기 중·저장됨이면 글과 상태만, 아니면(처음·실패) 쓰기 칸. EMR에서 회신된 의뢰는 여기서 보낸 글만 보인다
function ReplyPart({ c }: { c: ConsultRow }) {
  const sent = c.replyText && (
    <p className="mt-1 rounded-md bg-slate-50 p-2 whitespace-pre-wrap text-slate-700">{c.replyText}</p>
  );
  if (c.replied) return sent ? <div className="mt-3 border-t border-slate-100 pt-2">{sent}</div> : null;
  if (c.replyStatus === "PENDING") {
    return (
      <div className="mt-3 border-t border-slate-100 pt-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">EMR 저장 대기</span>
          {c.replyRequestedAt && <span className="text-xs text-slate-400">{fmtTime.format(c.replyRequestedAt)}에 요청</span>}
          <form action={cancelConsultReply}>
            <input type="hidden" name="id" value={c.id} />
            <button type="submit" className={buttonStyles.smallOutline}>
              요청 취소
            </button>
          </form>
        </div>
        {sent}
      </div>
    );
  }
  if (c.replyStatus === "SAVED") {
    return (
      <div className="mt-3 border-t border-slate-100 pt-2">
        <p className="text-sm">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">EMR에 저장됨</span>
          <span className="ml-2 text-xs text-slate-500">
            {c.replySavedAt && `${fmtTime.format(c.replySavedAt)} · `}서명 전 — EMR 타과의뢰 [일괄서명]에서 서명하세요
          </span>
        </p>
        {sent}
      </div>
    );
  }
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      {c.replyStatus === "FAILED" && (
        <p className="text-sm text-red-600">EMR 저장 실패: {c.replyMessage ?? "이유 모름"} — 고쳐서 다시 보내거나 EMR에서 직접 쓰세요</p>
      )}
      <ConsultReplyForm id={c.id} defaultText={c.replyText ?? ""} />
    </div>
  );
}
