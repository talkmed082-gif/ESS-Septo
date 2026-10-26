import { describe, expect, it } from "vitest";
import { nextClinicDate, nextClinicDatesByWeekday, parseSchedule, PatientCareBodySchema, sessionsOn } from "./clinic-schedule";

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
  // 사용자 실제 스케줄(2026-10-26): 화 오후 매주 + 금 오전 격주(YES 캘린더 예약: 11/6·11/20·12/4·12/18)
  const mine = [
    { weekday: 2, session: "PM" as const },
    { weekday: 5, session: "AM" as const, everyOtherFrom: "2026-11-06" },
  ];
  it("격주 금요일은 짝 맞는 주만(11/13은 아님, 11/20은 맞음)", () => {
    expect(nextClinicDate("2026-11-06", 7, mine, [])).toMatchObject({ date: "2026-11-17", weekday: "화" });
    expect(nextClinicDate("2026-11-06", 14, mine, [])).toMatchObject({ date: "2026-11-20", weekday: "금", sessions: ["오전"] });
    expect(nextClinicDate("2026-10-20", 3, mine, [])).toMatchObject({ date: "2026-10-23", weekday: "금" }); // 11/6과 2주 차이 → 외래 주
  });
  it("요일마다 가장 가까운 날(화 진료 뒤 2주: 11/10 화, 금은 격주라 11/20)", () => {
    expect(nextClinicDatesByWeekday("2026-10-27", 14, mine, []).map((d) => `${d.date}(${d.weekday})`)).toEqual(["2026-11-10(화)", "2026-11-20(금)"]);
  });
  it("격주 금요일이 휴진이면 그다음 짝 맞는 금요일", () => {
    expect(nextClinicDatesByWeekday("2026-11-06", 14, mine, [{ from: "2026-11-20", to: "2026-11-20" }]).map((d) => d.date)).toEqual(["2026-11-24", "2026-12-04"]);
  });
  it("격주 기준일이 없으면 매주(예전 저장값 그대로 동작)", () => {
    expect(sessionsOn("2026-11-13", [{ weekday: 5, session: "AM" }])).toHaveLength(1);
    expect(sessionsOn("2026-11-13", mine)).toHaveLength(0);
  });
  it("형식이 깨진 스케줄은 빈 것으로, Plan 입력 형식", () => {
    expect(parseSchedule([{ weekday: 9 }])).toEqual([]);
    expect(PatientCareBodySchema.safeParse({ chartNo: "12345678", planType: "medication" }).success).toBe(true);
    expect(PatientCareBodySchema.safeParse({ chartNo: "12345678", planType: "other" }).success).toBe(false);
  });
});
