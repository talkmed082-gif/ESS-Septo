import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const db = vi.hoisted(() => ({
  otps: [] as { id: string; codeHash: string; expiresAt: Date; usedAt: Date | null; createdById: string }[],
  sessions: [] as { tokenHash: string; expiresAt: Date; createdById: string }[],
  failures: 0,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/import-auth", () => ({ findUserByImportToken: async () => null }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    deviceOtp: {
      deleteMany: async ({ where }: { where: { createdById: string } }) => {
        db.otps = db.otps.filter((o) => o.createdById !== where.createdById || o.usedAt);
      },
      create: async ({ data }: { data: { codeHash: string; expiresAt: Date; createdById: string } }) => {
        db.otps.push({ id: `o${db.otps.length}`, usedAt: null, ...data });
      },
      findFirst: async ({ where }: { where: { codeHash: string; expiresAt: { gt: Date } } }) =>
        db.otps.find((o) => o.codeHash === where.codeHash && !o.usedAt && o.expiresAt > where.expiresAt.gt) ?? null,
      updateMany: async ({ where, data }: { where: { id: string }; data: { usedAt: Date } }) => {
        const o = db.otps.find((x) => x.id === where.id && !x.usedAt);
        if (o) o.usedAt = data.usedAt;
        return { count: o ? 1 : 0 };
      },
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

import { endDeviceSession, findUserForProgram, issueDeviceOtp, MAX_FAILURES, pairDevice } from "./device-auth";

const req = (token: string) => new Request("http://x", { headers: { authorization: `Bearer ${token}` } });

beforeEach(() => {
  db.otps = [];
  db.sessions = [];
  db.failures = 0;
});

describe("진료실 프로그램 1회 코드 연결", () => {
  it("6자리 코드는 해시로만 저장되고, 한 번 쓰면 세션 토큰이 나오며 두 번째는 실패", async () => {
    const { code } = await issueDeviceOtp("u1");
    expect(code).toMatch(/^\d{6}$/);
    expect(db.otps[0].codeHash).toBe(createHash("sha256").update(code).digest("hex"));
    const r = await pairDevice(code);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(db.sessions[0].tokenHash).not.toBe(r.token);
      expect(await findUserForProgram(req(r.token))).toEqual({ id: "u1", name: "정일구" });
      // 프로그램을 끄면 세션이 끊긴다
      expect(await endDeviceSession(req(r.token))).toBe(1);
      expect(await findUserForProgram(req(r.token))).toBeNull();
    }
    expect(await pairDevice(code)).toEqual({ ok: false, reason: "invalid" });
  });

  it("5분이 지난 코드·새로 받기 전 코드는 안 됨", async () => {
    const t0 = new Date("2026-10-24T08:00:00Z");
    const { code: old } = await issueDeviceOtp("u1", t0);
    const { code } = await issueDeviceOtp("u1", t0);
    if (old !== code) expect((await pairDevice(old, t0)).ok).toBe(false);
    expect((await pairDevice(code, new Date(t0.getTime() + 6 * 60000))).ok).toBe(false);
  });

  it(`틀린 시도가 ${MAX_FAILURES}번 몰리면 맞는 코드도 잠시 막힘`, async () => {
    const { code } = await issueDeviceOtp("u1");
    db.failures = MAX_FAILURES;
    expect(await pairDevice(code)).toEqual({ ok: false, reason: "locked" });
  });

  it("만료된 세션 토큰은 안 됨", async () => {
    db.sessions.push({ tokenHash: createHash("sha256").update("a".repeat(43)).digest("hex"), expiresAt: new Date(Date.now() - 1000), createdById: "u1" });
    expect(await findUserForProgram(req("a".repeat(43)))).toBeNull();
  });
});
