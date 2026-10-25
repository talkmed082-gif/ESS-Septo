import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const db = vi.hoisted(() => ({
  otps: [] as { id: string; codeHash: string; expiresAt: Date; usedAt: Date | null; createdById: string; createdAt: number }[],
  sessions: [] as { tokenHash: string; expiresAt: Date; createdById: string }[],
  failures: 0,
}));
vi.mock("server-only", () => ({}));
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret";
vi.mock("@/lib/import-auth", () => ({ findUserByImportToken: async () => null }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    deviceOtp: {
      deleteMany: async ({ where }: { where: { createdById: string } }) => {
        db.otps = db.otps.filter((o) => o.createdById !== where.createdById || o.usedAt);
      },
      create: async ({ data }: { data: { id: string; codeHash: string; expiresAt: Date; createdById: string } }) => {
        db.otps.push({ usedAt: null, createdAt: db.otps.length, ...data });
      },
      findFirst: async ({ where }: { where: { codeHash?: string; createdById?: string; expiresAt: { gt: Date } } }) =>
        [...db.otps]
          .reverse()
          .find(
            (o) =>
              (where.codeHash === undefined || o.codeHash === where.codeHash) &&
              (where.createdById === undefined || o.createdById === where.createdById) &&
              !o.usedAt &&
              o.expiresAt > where.expiresAt.gt,
          ) ?? null,
    },
    deviceOtpFailure: {
      count: async () => db.failures,
      create: async () => {
        db.failures++;
      },
    },
    deviceSession: {
      create: async ({ data }: { data: { tokenHash: string; expiresAt: Date; createdById: string } }) => {
        db.sessions.push(data);
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const s = db.sessions.find((x) => x.tokenHash === where.tokenHash);
        return s ? { expiresAt: s.expiresAt, createdBy: { id: s.createdById, name: "정일구" } } : null;
      },
      deleteMany: async ({ where }: { where: { tokenHash: string } }) => {
        const n = db.sessions.length;
        db.sessions = db.sessions.filter((x) => x.tokenHash !== where.tokenHash);
        return { count: n - db.sessions.length };
      },
    },
  },
}));

import { endDeviceSession, findUserForProgram, getDailyOtp, issueDeviceOtp, MAX_FAILURES, nextSeoulMidnight, pairDevice } from "./device-auth";

const req = (token: string) => new Request("http://x", { headers: { authorization: `Bearer ${token}` } });

beforeEach(() => {
  db.otps = [];
  db.sessions = [];
  db.failures = 0;
});

describe("진료실 프로그램 오늘의 번호 연결", () => {
  it("6자리 번호는 해시로만 저장되고, 그날은 여러 번 연결되며 세션은 프로그램을 끄면 끊긴다", async () => {
    const { code } = await getDailyOtp("u1");
    expect(code).toMatch(/^\d{6}$/);
    expect(db.otps[0].codeHash).toBe(createHash("sha256").update(code).digest("hex"));
    expect((await getDailyOtp("u1")).code).toBe(code); // 다시 열어도 같은 번호
    const r = await pairDevice(code);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(db.sessions[0].tokenHash).not.toBe(r.token);
      expect(await findUserForProgram(req(r.token))).toEqual({ id: "u1", name: "정일구" });
      expect(await endDeviceSession(req(r.token))).toBe(1);
      expect(await findUserForProgram(req(r.token))).toBeNull();
    }
    expect((await pairDevice(code)).ok).toBe(true); // 같은 날 다시 켜도 같은 번호
  });

  it("서울 자정에 만료되고, 새 번호를 받으면 전 번호는 바로 무효", async () => {
    const t0 = new Date("2026-10-24T14:30:00Z"); // 서울 23:30
    expect(nextSeoulMidnight(t0).toISOString()).toBe("2026-10-24T15:00:00.000Z");
    const { code: old } = await getDailyOtp("u1", t0);
    expect((await pairDevice(old, new Date("2026-10-24T15:01:00Z"))).ok).toBe(false);
    const { code } = await issueDeviceOtp("u1", t0);
    if (old !== code) expect((await pairDevice(old, t0)).ok).toBe(false);
    expect((await pairDevice(code, t0)).ok).toBe(true);
  });

  it(`틀린 시도가 ${MAX_FAILURES}번 몰리면 맞는 코드도 잠시 막힘`, async () => {
    const { code } = await getDailyOtp("u1");
    db.failures = MAX_FAILURES;
    expect(await pairDevice(code)).toEqual({ ok: false, reason: "locked" });
  });

  it("만료된 세션 토큰은 안 됨", async () => {
    db.sessions.push({ tokenHash: createHash("sha256").update("a".repeat(43)).digest("hex"), expiresAt: new Date(Date.now() - 1000), createdById: "u1" });
    expect(await findUserForProgram(req("a".repeat(43)))).toBeNull();
  });
});
