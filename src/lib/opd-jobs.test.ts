import { describe, expect, it } from "vitest";
import { OpdJobResultSchema, OpdJobSubmitSchema, isClaimable } from "./opd-jobs";

describe("노트북 외래 일감", () => {
  it("맡기기 형식: 할 일 기본은 모두 켜짐, 등록번호·날짜 확인", () => {
    const p = OpdJobSubmitSchema.parse({ visitDate: "2026-10-27", items: [{ chartNo: "12345678", tasks: {} }] });
    expect(p.items[0].tasks).toEqual({ note: true, dx: true, scope: true });
    expect(p.practice).toBe(false);
    expect(OpdJobSubmitSchema.safeParse({ visitDate: "10/27", items: [{ chartNo: "1", tasks: {} }] }).success).toBe(false);
    expect(OpdJobResultSchema.safeParse({ id: "x", status: "running" }).success).toBe(false);
  });

  it("가져갈 일감: 대기는 바로, 나중에 다시는 2분 뒤 10번까지, 멈춘 처리 중은 10분 뒤", () => {
    const now = new Date("2026-10-27T01:00:00Z");
    const ago = (m: number) => new Date(now.getTime() - m * 60_000);
    expect(isClaimable({ status: "pending", updatedAt: now, tries: 0 }, now)).toBe(true);
    expect(isClaimable({ status: "waiting", updatedAt: ago(1), tries: 1 }, now)).toBe(false);
    expect(isClaimable({ status: "waiting", updatedAt: ago(3), tries: 1 }, now)).toBe(true);
    expect(isClaimable({ status: "waiting", updatedAt: ago(3), tries: 10 }, now)).toBe(false);
    expect(isClaimable({ status: "running", updatedAt: ago(5), tries: 1 }, now)).toBe(false);
    expect(isClaimable({ status: "running", updatedAt: ago(11), tries: 1 }, now)).toBe(true);
    expect(isClaimable({ status: "done", updatedAt: ago(60), tries: 1 }, now)).toBe(false);
  });
});
