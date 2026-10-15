"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

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

// "동기화 요청" — 병원 PC가 평일 근무 시간(08:00~20:00)에 10분마다 확인해서 처리한다.
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

// 아직 EMR에 안 올라간(이 사이트에서 만든) 리마인더만 지울 수 있다 — EMR에 있는 것은
// EMR에서 지우면 다음 동기화 때 여기서도 사라진다.
export async function deleteReminder(reminderId: string, patientId: string): Promise<void> {
  const session = await verifySession();
  await prisma.reminder.deleteMany({
    where: { id: reminderId, createdById: session.userId, source: "ESS", emrRegSeq: null },
  });
  revalidatePath(`/patients/${patientId}`);
}
