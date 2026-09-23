import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (p.includes("src/generated") || p.endsWith(".test.ts")) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

const CALL = /prisma\.(patient|opPlan|opRecord)\.(findUnique|findFirst|findMany|update|updateMany|delete|deleteMany|count)\(/g;

describe("소유자 조건", () => {
  it("Patient/OpPlan/OpRecord 조회·수정·삭제는 모두 createdById 조건을 포함한다", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(CALL)) {
        const line = text.slice(0, m.index).split("\n").length;
        // 호출이 끝나는 줄(`);`로 끝나는 첫 줄)까지만 검사해서 근처 다른 호출의
        // createdById를 잘못 인정하지 않는다.
        const rest = text.split("\n").slice(line - 1);
        const end = rest.findIndex((l) => l.trimEnd().endsWith(");"));
        const window = rest.slice(0, end + 1).join("\n");
        if (!window.includes("createdById") && !window.includes("ownership-checked")) {
          offenders.push(`${file}:${line} ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
