import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// DB_OVER_HTTPS=1: 로컬 개발 전용 — 병원망은 Postgres 포트(5432)를 막아서 Neon WebSocket(443)으로 붙는다.
// 운영(Vercel)은 이 값을 두지 않아 지금처럼 pg로 붙는다.
const adapter =
  process.env.DB_OVER_HTTPS === "1"
    ? new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
    : new PrismaPg(process.env.DATABASE_URL!);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
