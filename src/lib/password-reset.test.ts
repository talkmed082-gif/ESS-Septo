import { describe, expect, it } from "vitest";
import {
  RESET_TOKEN_MINUTES,
  appBaseUrl,
  createResetToken,
  hashResetToken,
  inResetCooldown,
} from "./password-reset";

const now = new Date("2026-10-06T00:00:00Z");

describe("재설정 토큰", () => {
  it("원문 토큰의 해시를 저장용으로 돌려주고, 30분 뒤 만료된다", () => {
    const { token, hash, expiresAt } = createResetToken(now);
    expect(token.length).toBeGreaterThan(40);
    expect(hash).toBe(hashResetToken(token));
    expect(hash).not.toContain(token);
    expect(expiresAt.getTime() - now.getTime()).toBe(RESET_TOKEN_MINUTES * 60000);
  });

  it("매번 다른 토큰을 만든다", () => {
    expect(createResetToken(now).token).not.toBe(createResetToken(now).token);
  });

  it("방금 보낸 요청은 1분 동안 다시 보내지 않는다", () => {
    const { expiresAt } = createResetToken(now);
    expect(inResetCooldown(expiresAt, new Date(now.getTime() + 30_000))).toBe(true);
    expect(inResetCooldown(expiresAt, new Date(now.getTime() + 61_000))).toBe(false);
    expect(inResetCooldown(null, now)).toBe(false);
  });
});

describe("appBaseUrl", () => {
  it("APP_URL을 가장 먼저 쓴다", () => {
    expect(appBaseUrl({ APP_URL: "https://op.example.com/", NODE_ENV: "production" }, "https://evil.test")).toBe(
      "https://op.example.com",
    );
  });

  it("운영에서 설정이 없으면 요청 주소(Host 헤더)를 믿지 않는다", () => {
    expect(appBaseUrl({ NODE_ENV: "production" }, "https://evil.test")).toBeNull();
    expect(appBaseUrl({ NODE_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "app.vercel.app" }, "https://evil.test")).toBe(
      "https://app.vercel.app",
    );
  });

  it("개발 환경에서는 요청 주소를 쓴다", () => {
    expect(appBaseUrl({ NODE_ENV: "development" }, "http://localhost:3000")).toBe("http://localhost:3000");
  });
});
