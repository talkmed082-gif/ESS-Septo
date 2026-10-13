import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueUser, importRows } = vi.hoisted(() => ({ findUniqueUser: vi.fn(), importRows: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: findUniqueUser } } }));
vi.mock("@/lib/schedule-import-store", async () => {
  const z = await import("zod");
  return {
    importScheduleRows: importRows,
    ScheduleRowSchema: z.object({ date: z.string(), chartNo: z.string().min(1), surgeon: z.string() }),
  };
});

import { POST } from "./route";
import { generateCalendarToken } from "@/lib/calendar-feed";

const row = { date: "2026-10-16", chartNo: "12345678", surgeon: "정일구" };
const call = (auth: string | null, body: unknown = { rows: [row] }) =>
  POST(
    new Request("http://x/api/schedule-import", {
      method: "POST",
      headers: auth ? { authorization: auth, "content-type": "application/json" } : {},
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  findUniqueUser.mockReset();
  importRows.mockReset();
});

describe("POST /api/schedule-import", () => {
  it("토큰이 없거나 형식이 틀리면 DB를 조회하지 않고 404", async () => {
    for (const auth of [null, "Bearer ../secret", "Basic abc"]) {
      const res = await call(auth);
      expect(res.status).toBe(404);
    }
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it("없는 토큰이면 404이고 아무것도 만들지 않는다", async () => {
    findUniqueUser.mockResolvedValue(null);
    const res = await call(`Bearer ${generateCalendarToken()}`);
    expect(res.status).toBe(404);
    expect(importRows).not.toHaveBeenCalled();
  });

  it("본문 형식이 틀리면 400", async () => {
    findUniqueUser.mockResolvedValue({ id: "u1", name: "정일구" });
    const res = await call(`Bearer ${generateCalendarToken()}`, { rows: [{ date: "2026-10-16" }] });
    expect(res.status).toBe(400);
    expect(importRows).not.toHaveBeenCalled();
  });

  it("올바른 토큰이면 그 계정으로 가져오고 결과 건수를 돌려준다", async () => {
    const token = generateCalendarToken();
    findUniqueUser.mockResolvedValue({ id: "u1", name: "정일구" });
    importRows.mockResolvedValue({ created: 1, skipped: 0 });
    const res = await call(`Bearer ${token}`);
    expect(findUniqueUser).toHaveBeenCalledWith({ where: { importToken: token }, select: { id: true, name: true } });
    expect(importRows).toHaveBeenCalledWith({ id: "u1", name: "정일구" }, [row]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: 1, skipped: 0 });
  });
});
