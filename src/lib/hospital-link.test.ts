import { describe, expect, it } from "vitest";
import { kstDate, OutpatientListBodySchema, TsaRunBodySchema, validateTsaScanRange } from "@/lib/hospital-link";

// 2026-10-14 16:00 UTC = 10/15 01:00 KST
const NOW = new Date("2026-10-14T16:00:00Z");

describe("kstDate", () => {
  it("한국 시간 기준 날짜를 쓴다(UTC 자정 전후가 갈리는 시각)", () => {
    expect(kstDate(NOW)).toBe("2026-10-15");
    expect(kstDate(NOW, 1)).toBe("2026-10-16");
    expect(kstDate(new Date("2026-10-14T14:59:00Z"))).toBe("2026-10-14");
  });
});

describe("validateTsaScanRange", () => {
  it("내일까지는 된다", () => {
    expect(validateTsaScanRange("2026-09-01", "2026-10-16", NOW)).toBeNull();
  });
  it("내일보다 뒤는 막는다(미래 TSA는 신경외과만 넣어 뒀을 수 있음)", () => {
    expect(validateTsaScanRange("2026-10-01", "2026-10-17", NOW)).toMatch(/내일\(2026-10-16\)/);
  });
  it("시작이 끝보다 뒤면 막는다", () => {
    expect(validateTsaScanRange("2026-10-10", "2026-10-01", NOW)).toMatch(/시작 날짜/);
  });
  it("92일 넘는 기간은 막는다", () => {
    expect(validateTsaScanRange("2026-07-01", "2026-10-15", NOW)).toMatch(/92일/);
    expect(validateTsaScanRange("2026-07-16", "2026-10-15", NOW)).toBeNull();
  });
  it("날짜 형식이 아니면 막는다", () => {
    expect(validateTsaScanRange("", "2026-10-15", NOW)).toMatch(/날짜를/);
  });
});

describe("병원 PC 요청 형식", () => {
  it("TSA 결과: 보류·중복에 이름 칸이 없어도 받는다", () => {
    const ok = TsaRunBodySchema.safeParse({
      kind: "RANGE",
      from: "2026-09-01",
      to: "2026-10-15",
      found: 7,
      added: 0,
      skipped: 6,
      held: [{ date: "2026-09-23", chart4: "2886", rows: [325] }],
      dups: [],
      requestedAt: "2026-10-14T07:00:00.000Z",
    });
    expect(ok.success).toBe(true);
  });
  it("외래 명단: 날짜 형식이 틀리면 거절", () => {
    expect(OutpatientListBodySchema.safeParse({ date: "10/15", clinic: "x", rows: [] }).success).toBe(false);
  });
});
