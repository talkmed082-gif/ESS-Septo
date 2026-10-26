"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ClinicScheduleSchema } from "@/lib/clinic-schedule";

// 내 외래 스케줄 저장 — 체크칸 이름 "s-요일-AM|PM", 격주는 "bw-요일-AM|PM" + 기준일 "bwAnchor"(없으면 격주 무시)
export async function saveClinicSchedule(formData: FormData): Promise<void> {
  const session = await verifySession();
  const anchor = String(formData.get("bwAnchor") ?? "");
  const hasAnchor = /^\d{4}-\d{2}-\d{2}$/.test(anchor);
  const sessions = [...formData.keys()]
    .map((k) => /^s-(\d)-(AM|PM)$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({
      weekday: Number(m[1]),
      session: m[2] as "AM" | "PM",
      ...(hasAnchor && formData.has(`bw-${m[1]}-${m[2]}`) ? { everyOtherFrom: anchor } : {}),
    }));
  const parsed = ClinicScheduleSchema.safeParse(sessions);
  if (!parsed.success) return;
  // 모두 끄고 저장 = 자동 판단으로 돌아감(빈 배열 저장 → effectiveSchedule가 예약 명단으로)
  await prisma.user.update({ where: { id: session.userId }, data: { clinicSchedule: parsed.data } });
  revalidatePath("/settings");
}
