import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueUser, findManyPlans } = vi.hoisted(() => ({ findUniqueUser: vi.fn(), findManyPlans: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: findUniqueUser }, opPlan: { findMany: findManyPlans } },
}));

import { GET } from "./route";
import { generateCalendarToken } from "@/lib/calendar-feed";

const call = (token: string) => GET(new Request("http://x/api/calendar/" + token), { params: Promise.resolve({ token }) });

beforeEach(() => {
  findUniqueUser.mockReset();
  findManyPlans.mockReset();
});

describe("GET /api/calendar/[token]", () => {
  it("형식이 잘못된 토큰은 DB를 조회하지 않고 404", async () => {
    const res = await call("../secret");
    expect(res.status).toBe(404);
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it("형식은 맞지만 없는 토큰도 404이고 계획을 조회하지 않는다", async () => {
    findUniqueUser.mockResolvedValue(null);
    const res = await call(generateCalendarToken());
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
    expect(findManyPlans).not.toHaveBeenCalled();
  });

  it("올바른 토큰이면 그 주인의 계획만 조회해 .ics로 돌려준다", async () => {
    const token = generateCalendarToken();
    findUniqueUser.mockResolvedValue({ id: "user-1" });
    findManyPlans.mockResolvedValue([
      {
        id: "p1",
        plannedDate: new Date("2026-10-05T00:00:00.000Z"),
        updatedAt: new Date("2026-09-24T03:00:00.000Z"),
        status: "PLANNED",
        planData: { f_right_mma: true, f_left_mma: true },
        surgeryType: { code: "ESS", name: "ESS" },
        patient: { name: "홍길동" },
      },
    ]);
    const res = await call(token);
    expect(findUniqueUser).toHaveBeenCalledWith({ where: { calendarToken: token }, select: { id: true } });
    expect(findManyPlans.mock.calls[0][0].where).toMatchObject({ createdById: "user-1" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("SUMMARY:Both MMA");
    expect(body).toContain("UID:op-plan-p1@ess-septo");
    expect(body).not.toContain("홍길동");
  });
});
