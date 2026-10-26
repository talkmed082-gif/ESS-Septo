import { describe, expect, it } from "vitest";
import { ClinicCalendarBodySchema, clinicDays, inferSchedule, NEXT_VISIT_OPTIONS, nextClinicDate, nextClinicDatesByWeekday, parseSchedule, PatientCareBodySchema, sessionsOn } from "./clinic-schedule";

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
  it("예약 명단으로 자동 판단: 화 매주(지난 명단) + 금 격주(YES 캘린더 11/6·11/20·12/4·12/18)", () => {
    const dates = ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10", "2026-11-06", "2026-11-20", "2026-12-04", "2026-12-18", "2026-12-29"];
    expect(inferSchedule(dates, new Map([[2, "13:30"], [5, "09:00"]]))).toEqual([
      { weekday: 2, session: "PM" },
      { weekday: 5, session: "AM", everyOtherFrom: "2026-11-06" },
    ]);
  });
  it("자동 판단: 공휴일로 한 주 빠져도 매주(7일 간격이 있으면 매주), 날짜 하나뿐이면 매주, 시각 모르면 오전", () => {
    expect(inferSchedule(["2026-10-06", "2026-10-20", "2026-10-27"])).toEqual([{ weekday: 2, session: "AM" }]);
    expect(inferSchedule(["2026-11-06"])).toEqual([{ weekday: 5, session: "AM" }]);
    expect(inferSchedule([])).toEqual([]);
  });
  it("자동 판단한 스케줄로 다음 외래: 금 진료 뒤 2주 → 11/20(금)·11/24(화)", () => {
    const s = inferSchedule(["2026-10-27", "2026-11-03", "2026-11-06", "2026-11-20"], new Map([[2, "13:30"]]));
    expect(nextClinicDatesByWeekday("2026-11-06", 14, s, []).map((d) => `${d.date}(${d.weekday})`)).toEqual(["2026-11-20(금)", "2026-11-24(화)"]);
  });
  it("다음·1주 간격도: 10/27(화) 진료 뒤 '다음' = 11/3(화 — 10/30 금은 격주 쉬는 주), 다음의 요일별 = 11/3(화)·11/6(금)", () => {
    expect(NEXT_VISIT_OPTIONS.map((o) => o.label).slice(0, 3)).toEqual(["다음 외래", "1주", "2주"]);
    expect(nextClinicDate("2026-10-27", 1, mine, [])).toMatchObject({ date: "2026-11-03", weekday: "화" });
    expect(nextClinicDatesByWeekday("2026-10-27", 1, mine, []).map((d) => d.date)).toEqual(["2026-11-03", "2026-11-06"]);
    expect(nextClinicDatesByWeekday("2026-10-27", 7, mine, []).map((d) => d.date)).toEqual(["2026-11-03", "2026-11-06"]);
  });
  it("YES 캘린더 업로드 형식", () => {
    expect(ClinicCalendarBodySchema.safeParse({ from: "2026-10-27", to: "2027-04-27", days: [{ date: "2026-11-06", count: 10 }] }).success).toBe(true);
    expect(ClinicCalendarBodySchema.safeParse({ from: "2026-10-27", to: "2027-04-27", days: [{ date: "11/6", count: 10 }] }).success).toBe(false);
  });
  it("형식이 깨진 스케줄은 빈 것으로, Plan 입력 형식", () => {
    expect(parseSchedule([{ weekday: 9 }])).toEqual([]);
    expect(PatientCareBodySchema.safeParse({ chartNo: "12345678", planType: "medication" }).success).toBe(true);
    expect(PatientCareBodySchema.safeParse({ chartNo: "12345678", planType: "other" }).success).toBe(false);
  });
});

describe("clinicDays(다음 외래 달력)", () => {
  it("내일부터 스케줄 요일만, 휴진은 paused", () => {
    const sched = [{ weekday: 2, session: "PM" as const }, { weekday: 5, session: "AM" as const }];
    const r = clinicDays("2026-10-26", 12, sched, [{ from: "2026-10-30", to: "2026-10-30" }]);
    expect(r.map((x) => `${x.date}${x.weekday}${x.paused ? "휴" : ""}`)).toEqual(["2026-10-27화", "2026-10-30금휴", "2026-11-03화", "2026-11-06금"]);
  });
});
