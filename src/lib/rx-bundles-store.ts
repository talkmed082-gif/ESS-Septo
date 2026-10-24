import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ADULT_RX, DEFAULT_CHILD_RX, parseRxItems } from "@/lib/rx-bundles";

export async function getRxBundles(userId: string) {
  const rows = await prisma.rxBundle.findMany({
    where: { createdById: userId },
    orderBy: [{ audience: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, audience: true, sortOrder: true, items: true },
  });
  return rows.map((r) => ({ ...r, items: parseRxItems(r.items) }));
}

// 그 대상 묶음이 하나도 없을 때만 초안을 만든다
export async function createDefaultRxBundles(userId: string, audience: "adult" | "child") {
  if ((await prisma.rxBundle.count({ where: { createdById: userId, audience } })) > 0) return 0;
  const drafts = audience === "child" ? DEFAULT_CHILD_RX : DEFAULT_ADULT_RX;
  return (await prisma.rxBundle.createMany({ data: drafts.map((b) => ({ ...b, createdById: userId })) })).count;
}
