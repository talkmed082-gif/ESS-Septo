"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { generateCalendarToken } from "@/lib/calendar-feed";

// 구독 주소를 처음 만들거나 다시 만든다 — 새 토큰이 저장되는 순간 이전 주소는
// 더 이상 피드를 돌려주지 않는다.
export async function regenerateCalendarToken(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({
    where: { id: session.userId },
    data: { calendarToken: generateCalendarToken() },
  });
  revalidatePath("/settings");
}
