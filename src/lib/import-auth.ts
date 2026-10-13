import { prisma } from "@/lib/prisma";
import { isCalendarTokenFormat } from "@/lib/calendar-feed";

// 병원 PC 스크립트용 API 공통 인증 — Authorization: Bearer <importToken>.
// 토큰이 없거나 형식이 틀리면 DB를 조회하지 않고 null.
export async function findUserByImportToken(request: Request): Promise<{ id: string; name: string } | null> {
  const token = /^Bearer\s+(\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!isCalendarTokenFormat(token)) return null;
  return prisma.user.findUnique({ where: { importToken: token }, select: { id: true, name: true } });
}
