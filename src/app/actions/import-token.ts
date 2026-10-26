"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { generateCalendarToken } from "@/lib/calendar-feed";

// 병원 PC 자동 등록 토큰을 처음 만들거나 다시 만든다 — 새 토큰이 저장되는 순간
// 이전 토큰으로는 더 이상 올릴 수 없다. 형식은 캘린더 토큰과 같은 무작위 값.
export async function regenerateImportToken(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({
    where: { id: session.userId },
    data: { importToken: generateCalendarToken() },
  });
  revalidatePath("/hospital");
}

// 아이폰 단축어용 타과의뢰 "가져오기" 토큰 — 이것으로는 가져오기 요청만 할 수 있다. 다시 만들면 이전 토큰은 바로 막힌다
export async function regenerateConsultTriggerToken(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({
    where: { id: session.userId },
    data: { consultTriggerToken: generateCalendarToken() },
  });
  revalidatePath("/hospital");
}
