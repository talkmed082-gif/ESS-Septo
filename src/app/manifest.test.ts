import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA manifest", () => {
  const m = manifest();

  it("홈 화면 앱으로 설치되도록 독립 실행(standalone)이고 로그인 후 첫 화면(환자 목록)에서 시작한다", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/patients");
    expect(m.name).toBeTruthy();
    expect(m.short_name && m.short_name.length).toBeLessThanOrEqual(12); // 홈 화면 아이콘 밑 글자
  });

  it("192/512 아이콘과 마스크 가능한(maskable) 아이콘을 갖고, 가리키는 파일이 실제로 있다", () => {
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of m.icons ?? []) {
      expect(existsSync(join("public", icon.src)), icon.src).toBe(true);
    }
  });

  it("iOS 홈 화면용 아이콘(apple-touch-icon)이 있다", () => {
    expect(existsSync(join("public", "apple-touch-icon.png"))).toBe(true);
  });
});

describe("로그인 검사(proxy) 예외", () => {
  // 설치 정보(manifest)와 아이콘은 로그인 쿠키 없이 받아가므로 로그인 페이지로
  // 넘어가면 안 된다.
  const source = readFileSync("proxy.ts", "utf8");
  const matcher = /matcher:\s*\["([^"]+)"\]/.exec(source)![1].replace(/\\\\/g, "\\");
  const guarded = (path: string) => new RegExp("^" + matcher + "$").test(path);

  it.each(["/manifest.webmanifest", "/icon-192.png", "/apple-touch-icon.png", "/icon"])("%s 는 로그인 검사를 거치지 않는다", (path) => {
    expect(guarded(path)).toBe(false);
  });

  it.each(["/patients", "/settings", "/plans/abc"])("%s 는 여전히 로그인 검사를 거친다", (path) => {
    expect(guarded(path)).toBe(true);
  });
});
