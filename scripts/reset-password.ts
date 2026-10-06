// 메일 발송(SMTP)을 설정하기 전이나 메일이 안 올 때, 관리자가 직접 비밀번호를 바꾸는 명령.
// 사용법: DATABASE_URL=... npx tsx scripts/reset-password.ts <이메일> <새 비밀번호>
// 바꾸면 그 계정의 다른 기기 로그인도 모두 끊긴다.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("사용법: npx tsx scripts/reset-password.ts <이메일> <새 비밀번호>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("새 비밀번호는 8자 이상이어야 합니다.");
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } });
    if (!user) {
      console.error(`가입된 계정이 없습니다: ${email}`);
      process.exit(1);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });
    console.log(`${user.email} 계정의 비밀번호를 바꿨습니다.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
