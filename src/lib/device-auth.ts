import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { findUserByImportToken } from "@/lib/import-auth";

// 진료실 PC 프로그램(외래 도우미) 연결 — 사이트에서 받은 6자리 1회 코드를 프로그램에 넣으면
// 그 프로그램을 끌 때까지 쓰는 세션 토큰을 준다. 프로그램에 오래 남는 열쇠를 두지 않기 위함(사용자 요청 2026-10-24).
export const OTP_MINUTES = 5;
export const SESSION_HOURS = 16; // 끄지 않고 둔 경우의 한도(하루 진료 시간)
export const FAILURE_WINDOW_MINUTES = 10;
export const MAX_FAILURES = 10; // 10분에 틀린 코드가 이만큼 몰리면 연결을 잠시 막는다(6자리 대입 방지)

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function issueDeviceOtp(userId: string, now = new Date()) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$transaction([
    prisma.deviceOtp.deleteMany({ where: { createdById: userId, usedAt: null } }), // 새 코드를 받으면 전 코드는 무효
    prisma.deviceOtp.create({
      data: { codeHash: sha(code), expiresAt: new Date(now.getTime() + OTP_MINUTES * 60000), createdById: userId },
    }),
  ]);
  return { code, minutes: OTP_MINUTES };
}

export type PairResult = { ok: true; token: string; expiresAt: Date } | { ok: false; reason: "locked" | "invalid" };

export async function pairDevice(code: string, now = new Date()): Promise<PairResult> {
  const since = new Date(now.getTime() - FAILURE_WINDOW_MINUTES * 60000);
  if ((await prisma.deviceOtpFailure.count({ where: { createdAt: { gte: since } } })) >= MAX_FAILURES) {
    return { ok: false, reason: "locked" };
  }
  const otp = /^\d{6}$/.test(code)
    ? await prisma.deviceOtp.findFirst({ where: { codeHash: sha(code), usedAt: null, expiresAt: { gt: now } } })
    : null;
  // 한 번만 쓰이게: usedAt이 비어 있을 때만 찍히는 update로 동시에 두 번 들어와도 하나만 성공
  const used = otp
    ? await prisma.deviceOtp.updateMany({ where: { id: otp.id, usedAt: null }, data: { usedAt: now } })
    : { count: 0 };
  if (!otp || used.count !== 1) {
    await prisma.deviceOtpFailure.create({ data: {} });
    return { ok: false, reason: "invalid" };
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3600000);
  await prisma.deviceSession.create({ data: { tokenHash: sha(token), expiresAt, createdById: otp.createdById } });
  return { ok: true, token, expiresAt };
}

function bearer(request: Request) {
  return /^Bearer\s+(\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
}

export async function findUserByDeviceToken(request: Request) {
  const token = bearer(request);
  if (!/^[\w-]{43}$/.test(token)) return null;
  const s = await prisma.deviceSession.findUnique({
    where: { tokenHash: sha(token) },
    select: { expiresAt: true, createdBy: { select: { id: true, name: true } } },
  });
  return s && s.expiresAt > new Date() ? s.createdBy : null;
}

// 프로그램이 부르는 입구: 1회 코드로 연 세션, 또는 병원 PC 자동화 토큰(기존 방식)
export async function findUserForProgram(request: Request) {
  return (await findUserByDeviceToken(request)) ?? (await findUserByImportToken(request));
}

export async function endDeviceSession(request: Request) {
  const token = bearer(request);
  if (!token) return 0;
  return (await prisma.deviceSession.deleteMany({ where: { tokenHash: sha(token) } })).count;
}
