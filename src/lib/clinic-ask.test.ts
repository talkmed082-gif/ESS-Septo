import { describe, expect, it } from "vitest";
import { ClinicAskSchema, askState, clinicOrder } from "./clinic-ask";

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
