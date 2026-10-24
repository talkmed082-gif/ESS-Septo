"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { FIRST_FIELDS, FOLLOW_FIELDS, TemplateInputSchema } from "@/lib/outpatient-templates";
import { createDefaultOutpatientTemplates } from "@/lib/outpatient-templates-store";

// 외래 템플릿 — 본인 것만 고친다. 약속처방은 화면에서 JSON(hidden 칸)으로 넘어온다.
function parse(formData: FormData) {
  let setOrders: unknown = [];
  try {
    setOrders = JSON.parse(String(formData.get("setOrders") ?? "[]"));
  } catch {
    setOrders = null;
  }
  const fields = Object.fromEntries(
    [...FIRST_FIELDS, ...FOLLOW_FIELDS].map(([k]) => [k, String(formData.get(k) ?? "")]),
  );
  return TemplateInputSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind"),
    audience: formData.get("audience") ?? "adult",
    shortcut: formData.get("shortcut"),
    sortOrder: formData.get("sortOrder") || 0,
    ...fields,
    setOrders,
  });
}

function refresh() {
  revalidatePath("/templates");
}

export async function createOutpatientTemplate(formData: FormData): Promise<void> {
  const session = await verifySession();
  const parsed = parse(formData);
  if (!parsed.success) return;
  await prisma.outpatientTemplate.create({ data: { ...parsed.data, createdById: session.userId } });
  refresh();
}

export async function updateOutpatientTemplate(id: string, formData: FormData): Promise<void> {
  const session = await verifySession();
  const parsed = parse(formData);
  if (!parsed.success) return;
  await prisma.outpatientTemplate.updateMany({ where: { id, createdById: session.userId }, data: parsed.data });
  refresh();
}

export async function deleteOutpatientTemplate(id: string): Promise<void> {
  const session = await verifySession();
  await prisma.outpatientTemplate.deleteMany({ where: { id, createdById: session.userId } });
  refresh();
}

export async function createDefaultTemplates(audience: "adult" | "child"): Promise<void> {
  const session = await verifySession();
  await createDefaultOutpatientTemplates(session.userId, audience);
  refresh();
}
