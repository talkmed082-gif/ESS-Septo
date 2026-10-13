import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueUser, getTargets, applySync } = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  getTargets: vi.fn(),
  applySync: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: findUniqueUser } } }));
vi.mock("@/lib/reminder-sync-store", async () => {
  const z = await import("zod");
  return {
    getReminderSyncTargets: getTargets,
    applyReminderSync: applySync,
    ReminderSyncBodySchema: z.object({ pushed: z.array(z.unknown()), patients: z.array(z.unknown()) }),
  };
});

import { GET, POST } from "./route";
import { generateCalendarToken } from "@/lib/calendar-feed";

const req = (auth: string | null, init: RequestInit = {}) =>
  new Request("http://x/api/reminder-sync", {
    ...init,
    headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" },
  });

beforeEach(() => {
  findUniqueUser.mockReset();
  getTargets.mockReset();
  applySync.mockReset();
});

describe("/api/reminder-sync", () => {
  it("토큰이 틀리면 GET·POST 모두 404이고 아무것도 읽거나 쓰지 않는다", async () => {
    findUniqueUser.mockResolvedValue(null);
    expect((await GET(req("Bearer ../x"))).status).toBe(404);
    expect((await GET(req(`Bearer ${generateCalendarToken()}`))).status).toBe(404);
    expect((await POST(req(null, { method: "POST", body: "{}" }))).status).toBe(404);
    expect(getTargets).not.toHaveBeenCalled();
    expect(applySync).not.toHaveBeenCalled();
  });

  it("GET은 그 계정의 동기화 대상을 돌려준다", async () => {
    findUniqueUser.mockResolvedValue({ id: "u1", name: "정일구" });
    getTargets.mockResolvedValue({ patients: ["00000001"], pending: [] });
    const res = await GET(req(`Bearer ${generateCalendarToken()}`));
    expect(getTargets).toHaveBeenCalledWith("u1");
    expect(await res.json()).toEqual({ patients: ["00000001"], pending: [] });
  });

  it("POST 본문 형식이 틀리면 400, 맞으면 반영 결과를 돌려준다", async () => {
    findUniqueUser.mockResolvedValue({ id: "u1", name: "정일구" });
    const auth = `Bearer ${generateCalendarToken()}`;
    expect((await POST(req(auth, { method: "POST", body: JSON.stringify({ pushed: [] }) }))).status).toBe(400);
    applySync.mockResolvedValue({ linked: 0, created: 1, updated: 0, deleted: 0 });
    const res = await POST(req(auth, { method: "POST", body: JSON.stringify({ pushed: [], patients: [] }) }));
    expect(applySync).toHaveBeenCalledWith("u1", { pushed: [], patients: [] });
    expect(await res.json()).toEqual({ linked: 0, created: 1, updated: 0, deleted: 0 });
  });
});
