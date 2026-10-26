import { describe, expect, it } from "vitest";
import { isCancelledRoom, parseProfSurgeries, planNoteRoom, ProfScheduleBodySchema, roomLabel, splitCancelled } from "./prof-schedule";

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

describe("YES 수술방 번호", () => {
  it("66·77·88·99번 방은 취소된 수술", () => {
    for (const r of ["66", "Room77", "88", "099"]) expect(isCancelledRoom(r)).toBe(true);
    for (const r of ["5", "Room23", "6", "68", "", undefined, null]) expect(isCancelledRoom(r)).toBe(false);
  });

  it("방 이름은 번호만 뽑아 N번방", () => {
    expect(roomLabel("Room05")).toBe("5번방");
    expect(roomLabel("12")).toBe("12번방");
    expect(roomLabel("")).toBe("");
  });

  it("가져온 수술 계획 메모에서 방을 읽는다", () => {
    expect(planNoteRoom("진단: CRS\n스케줄: ESS\nRoom66 #2 · assist R2\n마취 GA")).toBe("Room66");
    // YES 수술실 칸이 번호만("05")이어도
    expect(planNoteRoom("스케줄: ESS\n05 #1 · assist R2")).toBe("05");
    expect(planNoteRoom("그냥 메모")).toBeNull();
    expect(planNoteRoom(null)).toBeNull();
  });

  it("방 번호를 같이 받고, 없어도 예전처럼 받는다", () => {
    expect(parseProfSurgeries([{ ...op, room: "88" }])).toEqual([{ ...op, room: "88" }]);
    expect(parseProfSurgeries([op])).toEqual([op]);
  });

  it("취소된 수술은 따로 나눈다", () => {
    const a = { ...op, room: "3" };
    const c = { ...op, room: "66" };
    expect(splitCancelled([a, c, op])).toEqual({ active: [a, op], cancelled: [c] });
  });
});
