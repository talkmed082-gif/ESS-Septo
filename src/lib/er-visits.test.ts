import { describe, expect, it } from "vitest";
import { checkOncallTimes, erDutyNames, erMyShifts, erNightStart, erOncallBlock } from "./er-visits";

const rows = [
  { date: "2026-10-30", name: "이동찬", kind: "평일 숙직" },
  { date: "2026-10-30", name: "정일구", kind: "평일 숙직" },
  { date: "2026-10-31", name: "정일구", kind: "휴일 일직" },
  { date: "2026-10-31", name: "정일구", kind: "휴일 숙직" },
  { date: "2026-10-31", name: "백승한", kind: "휴일 일직" },
  { date: "2026-10-31", name: "백승한", kind: "휴일 숙직" },
  { date: "2026-11-01", name: "오해진", kind: "휴일 일직" },
];

describe("erDutyNames", () => {
  it("그 당직일 당직자만, 나는 빼고 한 번씩", () => {
    expect(erDutyNames(rows, "2026-10-31", "정일구")).toEqual(["백승한"]);
  });
  it("당직표가 없으면 빈 목록", () => {
    expect(erDutyNames([], "2026-10-31", "정일구")).toEqual([]);
  });
});

describe("erMyShifts", () => {
  it("휴일 일직·숙직이면 둘, 평일 숙직이면 숙직만, 당직 없으면 없음", () => {
    expect(erMyShifts(rows, "2026-10-31", "정일구")).toEqual(["일직", "숙직"]);
    expect(erMyShifts(rows, "2026-10-30", "정일구")).toEqual(["숙직"]);
    expect(erMyShifts(rows, "2026-11-01", "정일구")).toEqual([]);
  });
});

describe("erOncallBlock", () => {
  const day = [
    { id: "a", shift: "일직", oncallStatus: "SAVED" },
    { id: "b", shift: "일직", oncallStatus: null },
    { id: "c", shift: "숙직", oncallStatus: null },
  ];
  it("같은 근무에 이미 저장한 환자가 있으면 막는다", () => {
    expect(erOncallBlock(day[1], day, ["일직", "숙직"])).toContain("이미");
  });
  it("다른 근무는 된다", () => {
    expect(erOncallBlock(day[2], day, ["일직", "숙직"])).toBeNull();
  });
  it("내 근무가 아니면 막는다(평일 일직 시간)", () => {
    expect(erOncallBlock(day[1], [day[1]], ["숙직"])).toContain("대상이 아닙니다");
  });
  it("실패한 신청은 자리를 차지하지 않는다", () => {
    expect(erOncallBlock(day[1], [{ id: "x", shift: "일직", oncallStatus: "FAILED" }, day[1]], ["일직"])).toBeNull();
  });
});

describe("checkOncallTimes", () => {
  it("순서가 맞으면 통과", () => {
    expect(checkOncallTimes({ call: "08:15", arrive: "10:30", end: "11:00" })).toBeNull();
  });
  it("형식이 틀리면 막는다", () => {
    expect(checkOncallTimes({ call: "8:15", arrive: "10:30", end: "11:00" })?.error).toContain("호출");
    expect(checkOncallTimes({ call: "08:15", arrive: "24:00", end: "11:00" })?.error).toContain("도착");
  });
  it("순서가 틀리면 막는다", () => {
    expect(checkOncallTimes({ call: "10:00", arrive: "09:00", end: "11:00" })?.error).toContain("호출");
    expect(checkOncallTimes({ call: "08:00", arrive: "10:30", end: "10:00" })?.error).toContain("종료");
  });
});

describe("erNightStart", () => {
  it("평일 숙직이면 17:30, 휴일이면 22:00", () => {
    expect(erNightStart(rows, "2026-10-30", "정일구")).toBe("17:30");
    expect(erNightStart(rows, "2026-10-31", "정일구")).toBe("22:00");
  });
});
