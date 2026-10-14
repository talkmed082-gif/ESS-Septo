"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// 내 문구 템플릿 — 계획 메모·수술 후 특이사항 칸에 고르면 그대로 붙는다. 본인 것만 고친다.
const TemplateSchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(4000),
});

function parse(formData: FormData) {
  return TemplateSchema.safeParse({ title: formData.get("title"), body: formData.get("body") });
}

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/plans", "layout");
  revalidatePath("/patients", "layout");
}

export async function createTextTemplate(formData: FormData): Promise<void> {
  const session = await verifySession();
  const parsed = parse(formData);
  if (!parsed.success) return;
  await prisma.textTemplate.create({ data: { ...parsed.data, createdById: session.userId } });
  refresh();
}

export async function updateTextTemplate(id: string, formData: FormData): Promise<void> {
  const session = await verifySession();
  const parsed = parse(formData);
  if (!parsed.success) return;
  await prisma.textTemplate.updateMany({ where: { id, createdById: session.userId }, data: parsed.data });
  refresh();
}

export async function deleteTextTemplate(id: string): Promise<void> {
  const session = await verifySession();
  await prisma.textTemplate.deleteMany({ where: { id, createdById: session.userId } });
  refresh();
}
