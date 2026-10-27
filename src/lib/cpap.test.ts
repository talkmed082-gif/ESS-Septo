import { describe, expect, it } from "vitest";
import { CpapUploadSchema, cpapDue, isCpapFollowUp } from "./cpap";

describe("CPAP F/U", () => {
  it("처방일 + 개월 = 기간 끝", () => {
    expect(cpapDue({ rxDate: "2026-04-27", months: 6 })).toBe("2026-10-27");
    expect(cpapDue({ rxDate: "2026-05-12", months: 3 })).toBe("2026-08-12");
    expect(cpapDue({ rxDate: null, months: 3 })).toBeNull();
  });
  it("기간이 지나(2주 일찍까지) 오는 외래만 F/U", () => {
    expect(isCpapFollowUp({ rxDate: "2026-04-27", months: 6 }, "2026-10-27")).toBe(true);
    expect(isCpapFollowUp({ rxDate: "2026-04-27", months: 6 }, "2026-10-14")).toBe(true);
    expect(isCpapFollowUp({ rxDate: "2026-04-27", months: 6 }, "2026-10-12")).toBe(false);
    expect(isCpapFollowUp({ rxDate: "2026-05-12", months: 3 }, "2026-10-27")).toBe(true);
    expect(isCpapFollowUp({ rxDate: null, months: null }, "2026-10-27")).toBe(false);
  });
  it("올리기 형식: 약자는 영어 대문자 두 글자", () => {
    expect(CpapUploadSchema.safeParse({ items: [{ chartNo: "12345678", cpap: { vendor: "YT", rxDate: "2026-05-12", months: 3 } }] }).success).toBe(true);
    expect(CpapUploadSchema.safeParse({ items: [{ chartNo: "12345678", cpap: { vendor: "yt" } }] }).success).toBe(false);
  });
});
