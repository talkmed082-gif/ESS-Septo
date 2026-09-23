import { describe, expect, it } from "vitest";
import { isEmailAllowed } from "./signup-policy";

describe("isEmailAllowed", () => {
  it("차단: 목록이 없거나 비어 있으면 아무도 가입할 수 없다", () => {
    expect(isEmailAllowed("a@x.com", undefined)).toBe(false);
    expect(isEmailAllowed("a@x.com", "")).toBe(false);
    expect(isEmailAllowed("a@x.com", " , ")).toBe(false);
  });
  it("목록에 있는 이메일만 허용한다", () => {
    expect(isEmailAllowed("a@x.com", "a@x.com,b@x.com")).toBe(true);
    expect(isEmailAllowed("c@x.com", "a@x.com,b@x.com")).toBe(false);
  });
  it("대소문자와 공백을 무시한다", () => {
    expect(isEmailAllowed(" A@X.com ", " a@x.com , b@x.com")).toBe(true);
  });
  it("부분 일치는 허용하지 않는다", () => {
    expect(isEmailAllowed("a@x.com.evil.com", "a@x.com")).toBe(false);
  });
});
