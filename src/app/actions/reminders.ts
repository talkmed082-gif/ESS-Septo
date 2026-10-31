"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { SILASTIC_REMINDER_TITLE } from "@/lib/remark";

const ReminderSchema = z.object({
  title: z.string().trim().min(1, { error: "제목을 입력하세요." }).max(100),
  dueDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  content: z.string().trim().max(2000),
});

export interface ReminderFormState {
  message?: string;
  ok?: boolean;
}

// 이 사이트에서 만든 리마인더 — 병원 PC가 다음 동기화 때 EMR Reminder에 추가한다.
export async function createReminder(
  patientId: string,
  _prev: ReminderFormState | undefined,
  formData: FormData,
): Promise<ReminderFormState> {
  const session = await verifySession();
  const parsed = ReminderSchema.safeParse({
    title: formData.get("title") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) return { message: z.flattenError(parsed.error).fieldErrors.title?.[0] ?? "입력값을 확인하세요." };

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, createdById: session.userId },
    select: { id: true },
  });
  if (!patient) return { message: "환자를 찾을 수 없습니다." };

  const { title, dueDate, content } = parsed.data;
  await prisma.reminder.create({
    data: {
      patientId: patient.id,
      title,
      dueDate: dueDate ? new Date(dueDate) : null,
      content: content || null,
      source: "ESS",
      createdById: session.userId,
    },
  });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

// "동기화 요청" — 병원 PC가 매일 08:00~20:00에 10분마다 확인해서 처리한다.
// 언제든 다시 누를 수 있고(요청 시각만 새로 바뀜), 처리되기 전에는 취소할 수 있다.
export async function requestReminderSync(patientId: string): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({ where: { id: session.userId }, data: { reminderSyncRequestedAt: new Date() } });
  revalidatePath(`/patients/${patientId}`);
}

export async function cancelReminderSync(patientId: string): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({ where: { id: session.userId }, data: { reminderSyncRequestedAt: null } });
  revalidatePath(`/patients/${patientId}`);
}

// 일정 알림 목록에서 체크 → 완료(다시 누르면 되돌림). EMR에서 온 알림도 사이트에서만 완료로 둔다(사용자 2026-10-27)
export async function setReminderDone(reminderId: string, done: boolean): Promise<void> {
  const session = await verifySession();
  if (typeof reminderId !== "string" || reminderId.length > 40) return;
  await prisma.reminder.updateMany({ where: { id: reminderId, createdById: session.userId }, data: { doneAt: done ? new Date() : null } });
  revalidatePath("/calendar");
  revalidatePath("/reminders");
}

// 일정 알림 목록에서 삭제 — 이 사이트에서 만든 것만(EMR에서 온 것은 다음 동기화 때 다시 생기므로 완료로)
export async function deleteReminderFromList(reminderId: string): Promise<void> {
  const session = await verifySession();
  if (typeof reminderId !== "string" || reminderId.length > 40) return;
  await prisma.reminder.deleteMany({ where: { id: reminderId, createdById: session.userId, source: "ESS", emrRegSeq: null } });
  revalidatePath("/calendar");
  revalidatePath("/reminders");
}

// 아직 EMR에 안 올라간(이 사이트에서 만든) 리마인더만 지울 수 있다 — EMR에 있는 것은
// EMR에서 지우면 다음 동기화 때 여기서도 사라진다.
export async function deleteReminder(reminderId: string, patientId: string): Promise<void> {
  const session = await verifySession();
  await prisma.reminder.deleteMany({
    where: { id: reminderId, createdById: session.userId, source: "ESS", emrRegSeq: null },
  });
  revalidatePath(`/patients/${patientId}`);
}



// Silastic을 넣은 계획에서 "제거 리마인더 추가" — 수술일 + 7일로 만든다(사용자 2026-10-16, 1주일~10일 사이 제거).
// 같은 환자에 이미 같은 제목이 있으면 또 만들지 않는다. 병원 PC가 다음 동기화 때 EMR에 올린다.
export async function addSilasticReminder(planId: string, surgeryDate: string): Promise<ReminderFormState> {
  const session = await verifySession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(surgeryDate)) return { message: "수술 날짜를 먼저 정해 주세요." };
  const plan = await prisma.opPlan.findFirst({
    where: { id: planId, createdById: session.userId },
    select: { patientId: true },
  });
  if (!plan) return { message: "수술 계획을 찾을 수 없습니다." };
  const exists = await prisma.reminder.findFirst({
    where: { patientId: plan.patientId, createdById: session.userId, title: SILASTIC_REMINDER_TITLE },
    select: { id: true },
  });
  if (exists) return { ok: true };
  const due = new Date(Date.parse(surgeryDate) + 7 * 86400000);
  await prisma.reminder.create({
    data: {
      patientId: plan.patientId,
      title: SILASTIC_REMINDER_TITLE,
      dueDate: due,
      content: `수술(${surgeryDate}) 후 1주일~10일 사이에 silastic sheet 제거`,
      source: "ESS",
      createdById: session.userId,
    },
  });
  revalidatePath(`/patients/${plan.patientId}`);
  revalidatePath(`/plans/${planId}`);
  return { ok: true };
}
