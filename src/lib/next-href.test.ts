import { describe, expect, it } from "vitest";
import { safeNextHref } from "./next-href";

describe("safeNextHref", () => {
  it("사이트 안 경로만 받는다", () => {
    expect(safeNextHref("/patients")).toBe("/patients");
    expect(safeNextHref("/plans/abc?view=post")).toBe("/plans/abc?view=post");
    expect(safeNextHref("https://evil.example")).toBeNull();
    expect(safeNextHref("//evil.example")).toBeNull();
    expect(safeNextHref("/\\evil.example")).toBeNull();
    expect(safeNextHref("")).toBeNull();
    expect(safeNextHref(null)).toBeNull();
  });
});
