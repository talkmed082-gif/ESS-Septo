import { describe, expect, it } from "vitest";
import { parseProfSurgeries, ProfScheduleBodySchema } from "./prof-schedule";

const op = { name: "홍*동", age: "45", sex: "M", chartNo: "01234567", op: "ESS" };

describe("교수님 외래·수술 올리기 형식", () => {
  it("4분 이름·기간 안 날짜만 받는다", () => {
    const ok = { from: "2026-10-26", to: "2026-11-08", items: [{ date: "2026-10-27", doctor: "박지환", outpatient: 12, surgeries: [op] }] };
    expect(ProfScheduleBodySchema.safeParse(ok).success).toBe(true);
    expect(ProfScheduleBodySchema.safeParse({ ...ok, items: [{ ...ok.items[0], doctor: "이민형" }] }).success).toBe(false);
    expect(ProfScheduleBodySchema.safeParse({ ...ok, items: [{ ...ok.items[0], date: "2026-11-09" }] }).success).toBe(false);
  });

  it("저장된 수술 목록이 깨져 있으면 빈 목록", () => {
    expect(parseProfSurgeries([op])).toEqual([op]);
    expect(parseProfSurgeries("x")).toEqual([]);
  });
});
