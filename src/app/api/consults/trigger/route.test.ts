import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueUser, updateManyUser } = vi.hoisted(() => ({ findUniqueUser: vi.fn(), updateManyUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: findUniqueUser, updateMany: updateManyUser } } }));

import { POST } from "./route";
import { generateCalendarToken } from "@/lib/calendar-feed";

const call = (auth: string | null) =>
  POST(new Request("http://x/api/consults/trigger", { method: "POST", headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  findUniqueUser.mockReset();
  updateManyUser.mockReset();
});

describe("POST /api/consults/trigger", () => {
  it("토큰이 없거나 형식이 틀리면 DB를 조회하지 않고 404", async () => {
    for (const auth of [null, "Bearer ../secret", "Basic abc"]) expect((await call(auth)).status).toBe(404);
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it("없는 토큰(병원 PC 토큰 포함)이면 404이고 요청을 남기지 않는다", async () => {
    findUniqueUser.mockResolvedValue(null);
    expect((await call(`Bearer ${generateCalendarToken()}`)).status).toBe(404);
    expect(updateManyUser).not.toHaveBeenCalled();
  });

  it("단축어 토큰이면 대기 중인 요청이 없을 때만 가져오기 요청을 남긴다", async () => {
    const token = generateCalendarToken();
    findUniqueUser.mockResolvedValue({ id: "u1" });
    updateManyUser.mockResolvedValue({ count: 1 });
    const res = await call(`Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(findUniqueUser).toHaveBeenCalledWith({ where: { consultTriggerToken: token }, select: { id: true } });
    expect(updateManyUser).toHaveBeenCalledWith({
      where: { id: "u1", consultCheckRequestedAt: null },
      data: { consultCheckRequestedAt: expect.any(Date) },
    });
  });
});
