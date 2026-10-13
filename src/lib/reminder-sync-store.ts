import "server-only";
import * as z from "zod";
import { prisma } from "@/lib/prisma";

// EMR(YES) Reminder 기본 탭 ↔ 이 사이트 리마인더 동기화. 병원 PC 스크립트가
//   1) GET으로 대상 환자(등록번호)와 EMR에 아직 안 올라간 리마인더를 받고
//   2) 그 리마인더를 EMR에 추가한 뒤, 대상 환자들의 EMR 리마인더 전체 목록과 함께 POST한다.
// EMR 리마인더의 짝은 (환자, EMR 등록일, EMR 순번)으로 맞춘다.

const SYNC_LOOKBACK_DAYS = 90;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const EmrReminderSchema = z.object({
  regDate: z.string().regex(DATE),
  regSeq: z.string().min(1),
  author: z.string(),
  title: z.string(),
  dueDate: z.string(),
  content: z.string(),
});
export const ReminderSyncBodySchema = z.object({
  pushed: z
    .array(z.object({ id: z.string().min(1), regDate: z.string().regex(DATE), regSeq: z.string().min(1) }))
    .max(200),
  patients: z
    .array(z.object({ chartNo: z.string().min(1), reminders: z.array(EmrReminderSchema).max(500) }))
    .max(500),
  // GET이 돌려준 serverTime — 이 시각 이전에 누른 "동기화 요청"만 처리된 것으로 보고 지운다
  // (동기화 도중에 새로 누른 요청은 남겨서 다음 확인 때 다시 처리한다)
  startedAt: z.iso.datetime(),
});
export type ReminderSyncBody = z.infer<typeof ReminderSyncBodySchema>;

function toDate(value: string): Date | null {
  return DATE.test(value) ? new Date(value) : null;
}

// 동기화 대상: 최근(90일 전 이후) 수술 계획이 있는 환자 + 리마인더가 이미 있는 환자 중 등록번호가 있는 환자
export async function getReminderSyncTargets(userId: string) {
  const since = new Date(Date.now() - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const patients = await prisma.patient.findMany({
    where: {
      createdById: userId,
      chartNo: { not: null },
      OR: [{ opPlans: { some: { plannedDate: { gte: since } } } }, { reminders: { some: {} } }],
    },
    select: { chartNo: true },
  });
  const pending = await prisma.reminder.findMany({
    where: { createdById: userId, source: "ESS", emrRegSeq: null, patient: { chartNo: { not: null } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, dueDate: true, content: true, patient: { select: { chartNo: true } } },
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { reminderSyncRequestedAt: true } });
  return {
    serverTime: new Date().toISOString(),
    // "동기화 요청" 버튼을 누른 시각(없으면 null) — 병원 PC의 10분 확인 작업은 이 값이 있을 때만 동기화한다
    requestedAt: user?.reminderSyncRequestedAt?.toISOString() ?? null,
    patients: patients.map((p) => p.chartNo!),
    pending: pending.map((r) => ({
      id: r.id,
      chartNo: r.patient.chartNo!,
      title: r.title,
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : "",
      content: r.content ?? "",
    })),
  };
}

export async function applyReminderSync(userId: string, body: ReminderSyncBody) {
  let linked = 0;
  let created = 0;
  let updated = 0;
  let deleted = 0;

  // 1) EMR에 새로 추가한 이 사이트 리마인더에 EMR 등록일·순번을 붙인다
  for (const p of body.pushed) {
    const res = await prisma.reminder.updateMany({
      where: { id: p.id, createdById: userId, emrRegSeq: null },
      data: { emrRegDate: p.regDate, emrRegSeq: p.regSeq },
    });
    linked += res.count;
  }

  // 2) 환자별로 EMR 목록을 반영한다 — 목록에 없는 EMR 리마인더는 EMR에서 지워진 것이라 여기서도 지운다
  for (const entry of body.patients) {
    const patient = await prisma.patient.findFirst({
      where: { chartNo: entry.chartNo, createdById: userId },
      select: { id: true },
    });
    if (!patient) continue;

    const existing = await prisma.reminder.findMany({
      where: { patientId: patient.id, createdById: userId, emrRegSeq: { not: null } },
      select: { id: true, emrRegDate: true, emrRegSeq: true },
    });
    const keyOf = (regDate: string | null, regSeq: string | null) => `${regDate}#${regSeq}`;
    const byKey = new Map(existing.map((r) => [keyOf(r.emrRegDate, r.emrRegSeq), r.id]));
    const seen = new Set<string>();

    for (const r of entry.reminders) {
      const key = keyOf(r.regDate, r.regSeq);
      seen.add(key);
      const data = {
        title: r.title || "(제목 없음)",
        dueDate: toDate(r.dueDate),
        content: r.content || null,
        authorName: r.author || null,
      };
      const id = byKey.get(key);
      if (id) {
        await prisma.reminder.update({ where: { id }, data });
        updated++;
      } else {
        await prisma.reminder.create({
          data: {
            ...data,
            patientId: patient.id,
            source: "EMR",
            emrRegDate: r.regDate,
            emrRegSeq: r.regSeq,
            createdById: userId,
          },
        });
        created++;
      }
    }

    const gone = existing.filter((r) => !seen.has(keyOf(r.emrRegDate, r.emrRegSeq))).map((r) => r.id);
    if (gone.length) {
      const res = await prisma.reminder.deleteMany({ where: { id: { in: gone }, createdById: userId } });
      deleted += res.count;
    }
  }

  // 동기화를 시작하기 전에 누른 요청만 지운다
  await prisma.user.updateMany({
    where: { id: userId, reminderSyncRequestedAt: { lte: new Date(body.startedAt) } },
    data: { reminderSyncRequestedAt: null },
  });

  console.info(`[reminder-sync] linked=${linked} created=${created} updated=${updated} deleted=${deleted}`);
  return { linked, created, updated, deleted };
}
