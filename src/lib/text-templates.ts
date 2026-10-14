import "server-only";
import { prisma } from "@/lib/prisma";

// 계획 화면에 넘길 내 문구 템플릿(만든 순서)
export function getTextTemplates(userId: string) {
  return prisma.textTemplate.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, body: true },
  });
}
