import { describe, expect, it } from "vitest";
import { LOCK_MINUTES, MAX_FAILED_LOGINS, lockedMinutesLeft, normalizeEmail, stateAfterFailure } from "./login-lock";

const now = new Date("2026-10-06T00:00:00Z");

describe("로그인 잠금", () => {
  it(`${MAX_FAILED_LOGINS}번째 실패에서 ${LOCK_MINUTES}분 잠그고 횟수를 0으로 되돌린다`, () => {
    let state = { failedLoginCount: 0, lockedUntil: null as Date | null };
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      state = stateAfterFailure(state, now);
      expect(state).toEqual({ failedLoginCount: i, lockedUntil: null });
    }
    state = stateAfterFailure(state, now);
    expect(state.failedLoginCount).toBe(0);
    expect(lockedMinutesLeft(state, now)).toBe(LOCK_MINUTES);
  });

  it("잠금 시간이 지나면 풀리고, 그 뒤 실패는 1부터 다시 센다", () => {
    const expired = { failedLoginCount: 0, lockedUntil: new Date(now.getTime() - 1000) };
    expect(lockedMinutesLeft(expired, now)).toBe(0);
    expect(stateAfterFailure(expired, now)).toEqual({ failedLoginCount: 1, lockedUntil: null });
  });

  it("남은 시간은 분 단위로 올림한다", () => {
    expect(lockedMinutesLeft({ failedLoginCount: 0, lockedUntil: new Date(now.getTime() + 61_000) }, now)).toBe(2);
  });
});

describe("normalizeEmail", () => {
  it("앞뒤 공백을 지우고 소문자로 맞춘다", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});
