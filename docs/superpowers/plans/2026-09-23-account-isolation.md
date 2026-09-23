# Account Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only allow-listed emails can sign up, and every account sees/modifies only its own patients, plans and records.

**Architecture:** Pure `isEmailAllowed` policy function used by `signup`. Every Prisma read/update/delete on Patient/OpPlan/OpRecord gets an explicit `createdById: userId` condition (`findUnique` -> `findFirst`). A source-scanning regression test fails if a new unscoped call is added.

**Tech Stack:** Next.js 16 server actions, Prisma 7, vitest 4.

## Global Constraints
- Env var name: `ALLOWED_EMAILS` (comma separated, case-insensitive, trimmed). Empty/unset => signup fully blocked.
- SurgeryType stays shared across accounts. No data-migration script.
- Not-owned records behave exactly like missing ones (`notFound()` / "찾을 수 없습니다").
- Test runner: `npm test` (vitest). Commit trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Signup allow-list

**Files:**
- Create: `src/lib/signup-policy.ts`, `src/lib/signup-policy.test.ts`
- Modify: `src/app/actions/auth.ts` (signup), `.env.example`, `README.md`

**Produces:** `isEmailAllowed(email: string, allowed: string | undefined): boolean`

- [ ] **Step 1: Failing test** — `src/lib/signup-policy.test.ts`:
```ts
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
```
- [ ] **Step 2:** `npx vitest run src/lib/signup-policy.test.ts` → FAIL (module missing).
- [ ] **Step 3:** `src/lib/signup-policy.ts`:
```ts
export function isEmailAllowed(email: string, allowed: string | undefined): boolean {
  const list = (allowed ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
```
- [ ] **Step 4:** In `signup` (auth.ts), right after `const { name, email, password } = validated.data;` add:
```ts
  if (!isEmailAllowed(email, process.env.ALLOWED_EMAILS)) {
    return { errors: { email: ["가입이 허용되지 않은 이메일입니다."] } };
  }
```
and `import { isEmailAllowed } from "@/lib/signup-policy";`. Add `ALLOWED_EMAILS=you@example.com` to `.env.example`; add a README line under Vercel 배포 step 3.
- [ ] **Step 5:** `npx vitest run` → PASS. Commit `feat: restrict signup to ALLOWED_EMAILS`.

### Task 2: Ownership guard test (RED for everything else)

**Files:** Create `src/lib/ownership-guard.test.ts`

- [ ] **Step 1: Write the test**
```ts
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
        const window = text.split("\n").slice(line - 1, line + 12).join("\n");
        if (!window.includes("createdById") && !window.includes("ownership-checked")) {
          offenders.push(`${file}:${line} ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
```
- [ ] **Step 2:** `npx vitest run src/lib/ownership-guard.test.ts` → FAIL listing ~20 offenders (this is the checklist for Tasks 3–4).
- [ ] **Step 3:** Commit test only (`test: guard against unscoped prisma calls`) — it stays red until Task 4 completes.

### Task 3: Scope read paths (pages, routes, libs)

**Files (Modify):** `src/app/(app)/patients/page.tsx`, `patients/[id]/page.tsx`, `patients/[id]/edit/page.tsx`, `patients/[id]/plans/new/page.tsx`, `plans/[id]/page.tsx`, `plans/[id]/record/page.tsx`, `records/[id]/page.tsx`, `records/[id]/edit/page.tsx`, `settings/page.tsx`, `src/app/plans/[id]/print/page.tsx`, `src/app/plans/[id]/ics/route.ts`, `src/app/records/[id]/print/page.tsx`, `src/app/print/fess-checklist/page.tsx`, `src/lib/patient-nasal-findings.ts`

Pattern for each (get the id via `const { userId } = await verifySession();` — pages using `getCurrentUser()` use `user.id`):
- `findUnique({ where: { id }, ... })` → `findFirst({ where: { id, createdById: userId }, ... })` (Patient/OpPlan).
- OpRecord: `where: { id, createdById: userId }`.
- `findMany` lists: add `createdById: userId` to `where` (patients list: `AND` with the search `OR`; upcomingPlans in patients & settings pages).
- fess-checklist: `where: { id: { in: planIds }, createdById: userId }`.
- `patient-nasal-findings.ts`: add a `userId` parameter, `where: { patientId, createdById: userId }`, update its callers.
- Existing `if (!x) notFound()` handles the miss. ics route: return the existing 404 JSON.
- [ ] After each file: `npx tsc --noEmit 2>&1 | grep -v "PageProps\|LayoutProps"` must be empty (those two errors are pre-existing generated-type noise).
- [ ] Commit `fix: scope read paths to the logged-in user`.

### Task 4: Scope write paths (server actions)

**Files (Modify):** `src/app/actions/patients.ts`, `op-plans.ts`, `op-records.ts`, `patient-plan.ts`

- `updatePatient`: `prisma.patient.updateMany({ where: { id: patientId, createdById: session.userId }, data })`.
- `deletePatient`: `deleteMany({ where: { id: patientId, createdById: session.userId } })`; `deletePatients`: add `createdById` to the `where`.
- `updateOpPlan`, `toggleOpPlanDone`: load plan with `findFirst({ where: { id: planId, createdById: userId } })`, keep the existing "찾을 수 없습니다" return; the following `update` goes by id only after this check — add comment `// ownership-checked above` on the update call.
- `deleteOpPlan`: `deleteMany({ where: { id: planId, createdById } })`.
- `createOpRecord`: plan lookup via `findFirst` with `createdById`. `updateOpRecord`: record lookup with `createdById`; comment the following update `// ownership-checked above`.
- `createPatientWithPlan`: existing patient lookup → `findFirst({ where: { id: data.existingPatientId, createdById: session.userId } })`.
- [ ] `npx vitest run` → ownership guard PASS, all other tests PASS.
- [ ] `npx tsc --noEmit` clean (besides the two known errors); `npm run lint`.
- [ ] Commit `fix: scope write paths to the logged-in user`.

### Task 5: Verify

- [ ] Add a temporary offender to confirm the guard fails (e.g. append `prisma.patient.findMany({})` in a scratch file under `src/`), then remove it.
- [ ] `npm test && npx tsc --noEmit && npm run lint`; report actual output.
- [ ] Remind the user: set `ALLOWED_EMAILS` in Vercel env (production + preview) **before deploying**, otherwise signup stays closed (login unaffected).
