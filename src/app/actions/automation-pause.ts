"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AutomationPauseSchema } from "@/lib/hospital-link";

// 자동화 쉬는 날(출장 등) — 그 기간에는 병원 PC가 EMR에 접속하지 않는다. 본인 것만 고친다.
export async function createAutomationPause(formData: FormData): Promise<void> {
  const session = await verifySession();
  const note = String(formData.get("note") ?? "").trim();
  const parsed = AutomationPauseSchema.safeParse({
    from: formData.get("from"),
    to: formData.get("to") || formData.get("from"),
    note: note || undefined,
  });
  if (!parsed.success) return;
  await prisma.automationPause.create({ data: { ...parsed.data, createdById: session.userId } });
  revalidatePath("/settings");
  revalidatePath("/hospital");
}

export async function deleteAutomationPause(id: string): Promise<void> {
  const session = await verifySession();
  await prisma.automationPause.deleteMany({ where: { id, createdById: session.userId } });
  revalidatePath("/settings");
  revalidatePath("/hospital");
}
