import { describe, expect, it } from "vitest";
import { DutyRosterBodySchema, myDutyDays } from "./duty-roster";

// YES 의사직 당직근무자 조회 10월 자료 모양 그대로
const rows = [
  { date: "2026-10-08", name: "백승한", kind: "평일 숙직" },
  { date: "2026-10-08", name: "정일구", kind: "평일 숙직" },
  { date: "2026-10-12", name: "박지환", kind: "평일 숙직" },
  { date: "2026-10-12", name: "김수경", kind: "평일 숙직" },
  { date: "2026-10-31", name: "정일구", kind: "휴일 숙직" },
  { date: "2026-10-31", name: "정일구", kind: "휴일 일직" },
  { date: "2026-10-31", name: "최재혁", kind: "휴일 일직" },
  { date: "2026-10-31", name: "김석현", kind: "휴일 숙직" },
  { date: "2026-10-31", name: "김석현", kind: "휴일 일직" },
];

describe("내 당직일과 같이 서는 사람", () => {
  it("내 당직이 있는 날만, 나는 빼고 같이 서는 사람", () => {
    const m = myDutyDays(rows, "정일구");
    expect([...m.keys()]).toEqual(["2026-10-08", "2026-10-31"]);
    expect(m.get("2026-10-08")).toEqual({ mine: ["숙직"], mates: [{ name: "백승한", kinds: ["숙직"] }] });
  });

  it("휴일 일직·숙직은 한 사람으로 묶고 일직 → 숙직 순서, 일직만 서는 사람도 포함", () => {
    expect(myDutyDays(rows, "정일구").get("2026-10-31")).toEqual({
      mine: ["일직", "숙직"],
      mates: [
        { name: "김석현", kinds: ["일직", "숙직"] },
        { name: "최재혁", kinds: ["일직"] },
      ],
    });
  });

  it("당직표에 내 이름이 없으면 빈 결과", () => {
    expect(myDutyDays(rows, "홍길동").size).toBe(0);
  });

  it("올리는 형식: 시간은 없어도 되고 날짜 형식은 검사", () => {
    expect(DutyRosterBodySchema.safeParse({ from: "2026-10-01", to: "2026-11-30", items: [{ date: "2026-10-08", empNo: "1", name: "정일구", kind: "평일 숙직" }] }).success).toBe(true);
    expect(DutyRosterBodySchema.safeParse({ from: "2026-10-01", to: "2026-11-30", items: [{ date: "2026.10.08", empNo: "1", name: "정일구", kind: "평일 숙직" }] }).success).toBe(false);
  });
});
