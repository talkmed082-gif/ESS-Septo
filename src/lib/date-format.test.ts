import { describe, expect, it } from "vitest";
import { localTodayStr, seoulNow, seoulTodayAsStoredDate } from "./date-format";

describe("seoulNow", () => {
  it("UTC로는 전날이어도 한국 시간 날짜·시간을 돌려준다", () => {
    // 한국 시간 2026-10-06 08:30 = UTC 2026-10-05 23:30
    expect(seoulNow(new Date("2026-10-05T23:30:00Z"))).toEqual({ date: "2026-10-06", time: "08:30" });
  });

  it("자정 직후도 00시로 표기한다", () => {
    expect(seoulNow(new Date("2026-10-05T15:05:00Z"))).toEqual({ date: "2026-10-06", time: "00:05" });
  });

  it("한국 기준 오늘을 저장 방식(UTC 자정)과 같은 Date로 만든다", () => {
    expect(seoulTodayAsStoredDate(new Date("2026-10-05T23:30:00Z")).toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
});

describe("localTodayStr", () => {
  it("YYYY-MM-DD로 0을 채워 만든다", () => {
    expect(localTodayStr(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
