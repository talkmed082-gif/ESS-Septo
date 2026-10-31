import { describe, expect, it } from "vitest";
import { checkOncallTimes, erDutyNames } from "./er-visits";

describe("erDutyNames", () => {
  const rows = [
    { date: "2026-10-30", name: "이동찬", kind: "평일 숙직" },
    { date: "2026-10-30", name: "김수경", kind: "휴일 일직" },
    { date: "2026-10-31", name: "정일구", kind: "휴일 일직" },
    { date: "2026-10-31", name: "백승한", kind: "휴일 일직" },
    { date: "2026-10-31", name: "백승한", kind: "휴일 숙직" },
    { date: "2026-11-01", name: "오해진", kind: "휴일 일직" },
  ];

  it("그날 당직 + 전날 숙직, 나는 빼고 한 번씩", () => {
    expect(erDutyNames(rows, "2026-10-31", "정일구")).toEqual(["백승한", "이동찬"]);
  });

  it("월이 바뀌는 날도 전날을 찾는다", () => {
    expect(erDutyNames([{ date: "2026-10-31", name: "백승한", kind: "휴일 숙직" }], "2026-11-01", "정일구")).toEqual(["백승한"]);
  });

  it("당직표가 없으면 빈 목록", () => {
    expect(erDutyNames([], "2026-10-31", "정일구")).toEqual([]);
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
