import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueUser, replace, getTemplates } = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  replace: vi.fn(),
  getTemplates: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: findUniqueUser } } }));
vi.mock("@/lib/outpatient-templates-store", () => ({
  replaceEmrSetOrders: replace,
  getOutpatientTemplates: getTemplates,
}));

import { POST } from "./route";
import { GET } from "../outpatient-templates/route";
import { generateCalendarToken } from "@/lib/calendar-feed";

const req = (auth: string | null, init: RequestInit = {}) =>
  new Request("http://x/api/emr-set-orders", {
    ...init,
    headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" },
  });

beforeEach(() => {
  findUniqueUser.mockReset();
  replace.mockReset();
  getTemplates.mockReset();
});

describe("진료실 PC 프로그램 입구(/api/emr-set-orders, /api/outpatient-templates)", () => {
  it("토큰이 틀리면 404이고 아무것도 읽거나 쓰지 않는다", async () => {
    findUniqueUser.mockResolvedValue(null);
    expect((await POST(req(`Bearer ${generateCalendarToken()}`, { method: "POST", body: "{}" }))).status).toBe(404);
    expect((await GET(req(null))).status).toBe(404);
    expect(replace).not.toHaveBeenCalled();
    expect(getTemplates).not.toHaveBeenCalled();
  });

  it("약속처방 목록: 형식이 틀리면 400, 맞으면 그 계정·사번으로 바꾼다", async () => {
    findUniqueUser.mockResolvedValue({ id: "u1", name: "정일구" });
    const auth = `Bearer ${generateCalendarToken()}`;
    expect((await POST(req(auth, { method: "POST", body: JSON.stringify({ ownerEmpNo: "x", items: [] }) }))).status).toBe(400);
    replace.mockResolvedValue({ ownerEmpNo: "2026539", count: 1 });
    const body = { ownerEmpNo: "2026539", ownerName: "정일구", items: [{ key: "k", path: "", name: "세트", level: 1 }] };
    const res = await POST(req(auth, { method: "POST", body: JSON.stringify(body) }));
    expect(replace).toHaveBeenCalledWith("u1", body);
    expect(res.headers.get("content-type")).toContain("charset=utf-8");
    expect(await res.json()).toEqual({ ownerEmpNo: "2026539", count: 1 });
  });

  it("템플릿: 그 계정 것만 돌려준다", async () => {
    findUniqueUser.mockResolvedValue({ id: "u1", name: "정일구" });
    getTemplates.mockResolvedValue([{ id: "t1", title: "코막힘" }]);
    const res = await GET(req(`Bearer ${generateCalendarToken()}`));
    expect(getTemplates).toHaveBeenCalledWith("u1");
    expect(await res.json()).toEqual({ templates: [{ id: "t1", title: "코막힘" }] });
  });
});
