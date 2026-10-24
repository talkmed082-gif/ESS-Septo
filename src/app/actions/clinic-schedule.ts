"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ClinicScheduleSchema } from "@/lib/clinic-schedule";

// 내 외래 스케줄 저장 — 체크칸 이름 "s-요일-AM|PM"
export async function saveClinicSchedule(formData: FormData): Promise<void> {
  const session = await verifySession();
  const sessions = [...formData.keys()]
    .map((k) => /^s-(\d)-(AM|PM)$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ weekday: Number(m[1]), session: m[2] as "AM" | "PM" }));
  const parsed = ClinicScheduleSchema.safeParse(sessions);
  if (!parsed.success) return;
  await prisma.user.update({ where: { id: session.userId }, data: { clinicSchedule: parsed.data } });
  revalidatePath("/settings");
}
