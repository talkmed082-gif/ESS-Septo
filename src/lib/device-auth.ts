import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { findUserByImportToken } from "@/lib/import-auth";

// 진료실 PC 프로그램(외래 도우미) 연결 — 사이트에 보이는 6자리 "오늘의 번호"를 프로그램에 넣으면
// 그 프로그램을 끌 때까지 쓰는 세션 토큰을 준다. 프로그램에 오래 남는 열쇠를 두지 않기 위함(사용자 요청 2026-10-24).
// 번호는 하루(서울 자정까지) 하나, 그날 여러 번 쓸 수 있다(사용자 요청 2026-10-25: 5분 1회는 번거로움).
// 새면 [새 번호]로 바로 바꾼다. 번호는 행 id에서 서버 비밀값으로 계산해 화면에 다시 보여 주고, DB에는 해시만 둔다.
export const SESSION_HOURS = 16; // 끄지 않고 둔 경우의 한도(하루 진료 시간)
export const FAILURE_WINDOW_MINUTES = 10;
export const MAX_FAILURES = 10; // 10분에 틀린 코드가 이만큼 몰리면 연결을 잠시 막는다(6자리 대입 방지)

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function codeFor(otpId: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set");
  const n = createHmac("sha256", secret).update(`device-otp:${otpId}`).digest().readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

// 다음 서울 자정
export function nextSeoulMidnight(now: Date) {
  const kst = new Date(now.getTime() + 9 * 3600000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1) - 9 * 3600000);
}

export type DailyOtp = { code: string; expiresAt: Date };

// 새 번호 — 오늘 쓰던 번호는 바로 무효
export async function issueDeviceOtp(userId: string, now = new Date()): Promise<DailyOtp> {
  const id = randomBytes(16).toString("base64url");
  const code = codeFor(id);
  const expiresAt = nextSeoulMidnight(now);
  await prisma.$transaction([
    prisma.deviceOtp.deleteMany({ where: { createdById: userId, usedAt: null } }),
    prisma.deviceOtp.create({ data: { id, codeHash: sha(code), expiresAt, createdById: userId } }),
  ]);
  return { code, expiresAt };
}

// 오늘의 번호 — 없으면(첫 접속·자정 지남) 새로 만든다
export async function getDailyOtp(userId: string, now = new Date()): Promise<DailyOtp> {
  const cur = await prisma.deviceOtp.findFirst({
    where: { createdById: userId, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, expiresAt: true },
  });
  return cur ? { code: codeFor(cur.id), expiresAt: cur.expiresAt } : issueDeviceOtp(userId, now);
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
  if (!otp) {
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

// 프로그램이 부르는 입구: 오늘의 번호로 연 세션, 또는 병원 PC 자동화 토큰(기존 방식)
export async function findUserForProgram(request: Request) {
  return (await findUserByDeviceToken(request)) ?? (await findUserByImportToken(request));
}

export async function endDeviceSession(request: Request) {
  const token = bearer(request);
  if (!token) return 0;
  return (await prisma.deviceSession.deleteMany({ where: { tokenHash: sha(token) } })).count;
}
