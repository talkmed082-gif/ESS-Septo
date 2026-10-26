import { describe, expect, it } from "vitest";
import { ClinicAskSchema, WorkerHoursSchema, askState, clinicOrder, visitStatuses } from "./clinic-ask";

describe("clinicOrder(폰·진료 어시스트 번호)", () => {
  it("시간 순, 같은 시간은 명단 순서 그대로", () => {
    const rows = [
      { time: "14:30", c: "a" },
      { time: "13:00", c: "b" },
      { time: "14:30", c: "c" },
      { time: "09:10", c: "d" },
    ];
    expect(clinicOrder(rows).map((r) => r.c)).toEqual(["d", "b", "a", "c"]);
    expect(rows[0].c).toBe("a"); // 원본은 그대로
  });
});

describe("askState", () => {
  const t0 = new Date("2026-10-27T05:00:00Z");
  const at = (s: number) => new Date(t0.getTime() + s * 1000);
  it("1분 넘게 안 가져가면 노트북 응답 없음", () => {
    expect(askState({ status: "pending", createdAt: t0, answeredAt: null }, at(30))).toBe("waiting");
    expect(askState({ status: "pending", createdAt: t0, answeredAt: null }, at(61))).toBe("nopickup");
  });
  it("가져간 뒤 5분 넘으면 시간 초과", () => {
    expect(askState({ status: "running", createdAt: t0, answeredAt: null }, at(120))).toBe("running");
    expect(askState({ status: "running", createdAt: t0, answeredAt: null }, at(301))).toBe("timeout");
  });
  it("done/failed는 그대로", () => {
    expect(askState({ status: "done", createdAt: t0, answeredAt: t0 }, at(999))).toBe("done");
    expect(askState({ status: "failed", createdAt: t0, answeredAt: t0 }, at(1))).toBe("failed");
  });
});

describe("ClinicAskSchema", () => {
  it("빈 질문·긴 질문·이상한 번호는 거절", () => {
    expect(ClinicAskSchema.safeParse({ visitDate: "2026-10-27", chartNo: "12345678", question: "  " }).success).toBe(false);
    expect(ClinicAskSchema.safeParse({ visitDate: "2026-10-27", chartNo: "12345678", question: "x".repeat(301) }).success).toBe(false);
    expect(ClinicAskSchema.safeParse({ visitDate: "2026-10-27", chartNo: "12a45", question: "q" }).success).toBe(false);
    expect(ClinicAskSchema.safeParse({ visitDate: "2026-10-27", chartNo: "12345678", question: "오늘 확인할 것" }).success).toBe(true);
  });
});

describe("visitStatuses(진료 상태)", () => {
  const t = (m: number) => new Date(Date.UTC(2026, 9, 27, 5, m));
  it("마지막으로 연 환자는 진료 중, 그 전은 완료, 안 연 환자는 진료 전", () => {
    const s = visitStatuses([
      { chartNo: "1001", openedAt: t(1), done: null },
      { chartNo: "1002", openedAt: t(9), done: null },
      { chartNo: "1003", openedAt: null, done: null },
    ]);
    expect([s.get("1001"), s.get("1002"), s.get("1003")]).toEqual(["done", "now", "wait"]);
  });
  it("직접 정한 것이 우선 — 완료로 바꾼 환자는 진료 중이 아니고, 완료 취소한 환자는 진료 전", () => {
    const s = visitStatuses([
      { chartNo: "1001", openedAt: t(1), done: false },
      { chartNo: "1002", openedAt: t(9), done: true },
      { chartNo: "1003", openedAt: null, done: true },
    ]);
    expect([s.get("1001"), s.get("1002"), s.get("1003")]).toEqual(["now", "done", "done"]);
  });
  it("앞 0은 빼고 맞춘다", () => {
    expect(visitStatuses([{ chartNo: "0096", openedAt: t(1), done: null }]).get("96")).toBe("now");
  });
});

describe("WorkerHoursSchema", () => {
  it("HH:mm, 06:00 이후 시작, 끝이 더 늦어야", () => {
    expect(WorkerHoursSchema.safeParse({ from: "07:30", until: "19:00" }).success).toBe(true);
    expect(WorkerHoursSchema.safeParse({ from: "7:30", until: "19:00" }).success).toBe(false);
    expect(WorkerHoursSchema.safeParse({ from: "05:30", until: "19:00" }).success).toBe(false);
    expect(WorkerHoursSchema.safeParse({ from: "19:00", until: "07:30" }).success).toBe(false);
    expect(WorkerHoursSchema.safeParse({ from: "07:30", until: "24:00" }).success).toBe(false);
  });
});
