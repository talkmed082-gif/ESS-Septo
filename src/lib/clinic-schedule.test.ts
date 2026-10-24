import { describe, expect, it } from "vitest";
import { nextClinicDate, parseSchedule, PatientCareBodySchema } from "./clinic-schedule";

// 2026-10-24는 토요일
describe("다음 외래 날짜", () => {
  const monThu = [
    { weekday: 1, session: "PM" as const },
    { weekday: 4, session: "AM" as const },
  ];
  it("간격 뒤 첫 외래 요일(월·목)", () => {
    expect(nextClinicDate("2026-10-24", 28, monThu, [])).toEqual({ date: "2026-11-23", weekday: "월", sessions: ["오후"] });
    expect(nextClinicDate("2026-10-24", 14, monThu, [])).toMatchObject({ date: "2026-11-09", weekday: "월" });
  });
  it("휴진 기간은 건너뜀", () => {
    expect(nextClinicDate("2026-10-24", 28, monThu, [{ from: "2026-11-21", to: "2026-11-25" }])).toMatchObject({ date: "2026-11-26", weekday: "목" });
  });
  it("스케줄이 비면 그 날짜 그대로", () => {
    expect(nextClinicDate("2026-10-24", 14, [], [])).toMatchObject({ date: "2026-11-07", weekday: "토" });
  });
  it("형식이 깨진 스케줄은 빈 것으로, Plan 입력 형식", () => {
    expect(parseSchedule([{ weekday: 9 }])).toEqual([]);
    expect(PatientCareBodySchema.safeParse({ chartNo: "12345678", planType: "medication" }).success).toBe(true);
    expect(PatientCareBodySchema.safeParse({ chartNo: "12345678", planType: "other" }).success).toBe(false);
  });
});
