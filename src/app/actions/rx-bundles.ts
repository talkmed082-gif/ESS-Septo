"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { RxBundleInputSchema } from "@/lib/rx-bundles";
import { createDefaultRxBundles } from "@/lib/rx-bundles-store";

// 처방 묶음 — 본인 것만. 약 목록은 화면의 JSON 칸으로 고친다(소아 계산 규칙까지 그대로 보이게)
function parse(formData: FormData) {
  let items: unknown = null;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    items = null;
  }
  return RxBundleInputSchema.safeParse({
    title: formData.get("title"),
    audience: formData.get("audience") ?? "adult",
    sortOrder: formData.get("sortOrder") || 0,
    items,
  });
}

export type RxFormState = { error?: string; ok?: boolean } | undefined;

export async function updateRxBundle(id: string, _s: RxFormState, formData: FormData): Promise<RxFormState> {
  const session = await verifySession();
  const parsed = parse(formData);
  if (!parsed.success) return { error: "약 목록 형식이 올바르지 않습니다(코드·이름 필수, 소아 규칙 형식 확인)." };
  await prisma.rxBundle.updateMany({ where: { id, createdById: session.userId }, data: parsed.data });
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteRxBundle(id: string): Promise<void> {
  const session = await verifySession();
  await prisma.rxBundle.deleteMany({ where: { id, createdById: session.userId } });
  revalidatePath("/templates");
}

export async function createDefaultRx(audience: "adult" | "child"): Promise<void> {
  const session = await verifySession();
  await createDefaultRxBundles(session.userId, audience);
  revalidatePath("/templates");
}
