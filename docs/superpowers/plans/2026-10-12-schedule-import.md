# 수술 스케줄 엑셀 가져오기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주간 "ENT 수술 스케줄" 엑셀을 올리면 로그인한 교수님 본인 행만 미리보기로 보여주고, 체크한 행을 Patient + OpPlan(PLANNED)으로 만든다. COMBO 수술명도 Septoturbinoplasty 규칙에 맞춘다.

**Architecture:** 순수 로직(`src/lib/schedule-import.ts`: 술식 매핑·나이·planData, `src/lib/schedule-workbook.ts`: 엑셀 → 행)과 서버 액션(`src/app/actions/schedule-import.ts`: 미리보기·생성), 화면(`src/app/(app)/import/`)으로 나눈다. 엑셀 파일은 서버 메모리에서만 파싱하고 저장하지 않는다.

**Tech Stack:** Next.js 16 App Router + Server Actions, Prisma 7 (Postgres), zod 4, vitest, 신규 `exceljs@4.4.0`.

**Spec:** `docs/superpowers/specs/2026-10-12-schedule-import-design.md`

## Global Constraints

- **고정 규칙: 엑셀 `Septoturbinoplasty` = Septoplasty + Inferior turbinoplasty 양측.** 괄호 표기와 무관. 사이트 수술명도 "Septoturbinoplasty".
- 대상 행: `교수님` == `User.name` (양쪽 trim 후 완전 일치). 다른 교수님 행은 응답·로그·DB 어디에도 남기지 않는다.
- ESS/Septo 계열이 아닌 수술은 미리보기 "지원 안 됨"(생성 불가).
- 엑셀 원본 저장 금지, 로그는 건수만, 외부 API(Jev 등) 호출 금지.
- 테스트 픽스처는 가상 데이터로 코드에서 생성(실제 파일·실명·등록번호 커밋 금지).
- Patient/OpPlan 조회·수정은 모두 `createdById` 조건 포함(`src/lib/ownership-guard.test.ts`가 검사).
- 사용자 승인됨: `op-note-generator.test.ts`의 "병행은 Septoplasty + ESS 이름에 turbinoplasty 접미사를 붙인다" 기대값 변경.
- 작업 브랜치: `feat/schedule-import` (기본 브랜치 `claude/op-plan-recording-program-vxn1w1`에서 분기).
- Next 16은 학습 데이터와 다르다 — 서버 액션/설정은 `node_modules/next/dist/docs/` 확인.

## Review Focus

1. **실제 파일 크기 1.3MB** — Server Action 기본 body 한도(1MB)를 넘는다 → `next.config.ts`에 `experimental.serverActions.bodySizeLimit: "4mb"` (Task 4, 브라우저 검증 Task 6).
2. **시트 범위가 `A1:XFD54`(16384열)** — 열 끝까지 도는 파서는 느리거나 메모리를 많이 쓴다 → 헤더에서 찾은 열만 읽는다(Task 3 테스트: 넓은 시트).
3. **이름 공백** — `"정일구 "`처럼 셀/계정 이름 끝 공백 → trim 비교(Task 3 테스트).
4. **날짜 셀 형태** — 문자열 `"2026-10-12"`, 진짜 Date 셀, 날짜 앞 빈 행 모두 처리, 날짜 없는 행은 버림(Task 3 테스트).
5. **엉뚱한 파일** — 헤더(`교수님`, `수술`)가 없는 xlsx나 xlsx가 아닌 파일 → 500이 아니라 "형식을 알 수 없는 파일" 메시지(Task 3 테스트 + Task 4 액션 처리).

---

### Task 1: COMBO 수술명 Septoturbinoplasty 규칙

**Files:**
- Modify: `src/lib/op-note-generator.ts:954-980` (`buildProcedureName`)
- Test: `src/lib/op-note-generator.test.ts:229-234`

**Interfaces:**
- Consumes: 기존 `turbSideFlags`, `turbinoplastyGlobalSuffix`, `buildFessProcedureName`, `revisionPrefixText`
- Produces: `buildProcedureName("COMBO", values)` — Inferior 양측이면 `"Septoturbinoplasty + {ESS…}"`, 접미사에서 양측 inferior 제외

- [ ] **Step 0: 브랜치**

```bash
git switch claude/op-plan-recording-program-vxn1w1 && git pull && git switch -c feat/schedule-import
```

- [ ] **Step 1: 테스트 수정(승인됨) + 새 테스트**

`op-note-generator.test.ts`의 기존 테스트를 바꾼다:

```ts
  it("병행에서 Inferior 양측이면 Septoturbinoplasty + ESS로 쓴다", () => {
    const values = { ...fessSteps("both", ["mma", "ant_eth"]), turb_inferior_right: true, turb_inferior_left: true };
    expect(buildProcedureName("COMBO", values)).toBe("Septoturbinoplasty + Both ESS(Ethmoid, Maxillary)");
  });

  it("병행에서 Inferior 한쪽만이면 Septoplasty를 유지한다", () => {
    const values = { ...fessSteps("both", ["mma", "ant_eth"]), turb_inferior_right: true };
    expect(buildProcedureName("COMBO", values)).toMatch(/^Septoplasty \+ /);
  });

  it("병행에서 Inferior 양측 + Middle 양측이면 Middle만 접미사로 남는다", () => {
    const values = {
      ...fessSteps("both", ["mma"]),
      turb_inferior_right: true, turb_inferior_left: true,
      turb_middle_right: true, turb_middle_left: true,
    };
    expect(buildProcedureName("COMBO", values)).toBe("Septoturbinoplasty + Both ESS(Maxillary) + Both Mturbinoplasty");
  });

  it("단독 비중격은 Inferior 양측이면 Septoturbinoplasty", () => {
    expect(buildProcedureName("SEPTOPLASTY", { turb_inferior_right: true, turb_inferior_left: true })).toBe("Septoturbinoplasty");
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/op-note-generator.test.ts`
Expected: 새 COMBO 테스트 2개 FAIL (`"Septoplasty + Both ESS(...) + Both Turbinoplasty"` 반환). 단독 테스트는 이미 PASS.

- [ ] **Step 3: 구현** — `buildProcedureName` 끝부분:

```ts
  const fessName = buildFessProcedureName(values, "ESS", style, excludeSides);
  if (surgeryCode === "ESS") {
    return `${revisionPrefix}${fessName}${turbSuffix}`.replace(/\s+/g, " ").trim();
  }
  // 병행(COMBO)도 단독 비중격(septoplastyProcedureName)과 같은 규칙 — Inferior
  // 양측이면 "Septoturbinoplasty"라는 한 단어에 이미 담기므로 접미사에서 뺀다.
  const inferior = turbSideFlags("inferior", values);
  const bothInferior = inferior.right && inferior.left;
  const septoWord = bothInferior ? "Septoturbinoplasty" : "Septoplasty";
  const comboTurbSuffix = bothInferior
    ? turbinoplastyGlobalSuffix({ ...values, turb_inferior_right: false, turb_inferior_left: false }, style, hasFessRegions)
    : turbSuffix;
  const combined = fessName ? `${septoWord} + ${fessName}` : septoWord;
  return `${revisionPrefix}${combined}${comboTurbSuffix}`.replace(/\s+/g, " ").trim();
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run`
Expected: 전부 PASS (기존 136 + 신규). 다른 테스트가 옛 COMBO 이름을 기대해 깨지면 **멈추고 사용자에게 보고**(테스트 임의 수정 금지).

- [ ] **Step 5: Commit**

```bash
git add src/lib/op-note-generator.ts src/lib/op-note-generator.test.ts
git commit -m "fix: 병행 수술명도 Inferior 양측이면 Septoturbinoplasty로 표기"
```

---

### Task 2: 술식 매핑·나이·planData (순수 함수)

**Files:**
- Create: `src/lib/schedule-import.ts`
- Test: `src/lib/schedule-import.test.ts`

**Interfaces:**
- Consumes: `resolveSurgeryTypeFields({code, fields})` (`op-note-defs.ts`), `applyFieldDefaults(values, fields)` (`field-types.ts`), `FieldValues`
- Produces:
  - `type ImportSurgeryCode = "ESS" | "SEPTOPLASTY" | "COMBO"`
  - `interface ProcedureMapping { code: ImportSurgeryCode | null; overrides: FieldValues }`
  - `mapScheduleProcedure(text: string): ProcedureMapping`
  - `parseScheduleAge(text: string): number | null`
  - `buildImportPlanData(mapping: ProcedureMapping & { code: ImportSurgeryCode }): FieldValues`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from "vitest";
import { buildImportPlanData, mapScheduleProcedure, parseScheduleAge } from "./schedule-import";
import { buildProcedureName } from "./op-note-generator";

describe("mapScheduleProcedure", () => {
  it("ESS만이면 ESS", () => {
    expect(mapScheduleProcedure("ESS[B]")).toEqual({ code: "ESS", overrides: {} });
  });
  it("Septoplasty만이면 SEPTOPLASTY + Inferior 해제", () => {
    expect(mapScheduleProcedure("Septoplasty")).toEqual({
      code: "SEPTOPLASTY",
      overrides: { turb_inferior_right: false, turb_inferior_left: false },
    });
  });
  it("Septoturbinoplasty는 괄호와 무관하게 Inferior 양측", () => {
    for (const t of ["Septoturbinoplasty", "Septoturbinoplasty[R]", "septoturbinoplasty [L]"]) {
      expect(mapScheduleProcedure(t)).toEqual({
        code: "SEPTOPLASTY",
        overrides: { turb_inferior_right: true, turb_inferior_left: true },
      });
    }
  });
  it("ESS + Septo 계열이면 COMBO", () => {
    expect(mapScheduleProcedure("Septoplasty ; ESS[B]").code).toBe("COMBO");
    expect(mapScheduleProcedure("Septoturbinoplasty ; ESS[B]").overrides).toEqual({
      turb_inferior_right: true, turb_inferior_left: true,
    });
  });
  it("ITR[side]는 해당 측 Inferior를 켠다", () => {
    expect(mapScheduleProcedure("ESS[B] ; Septoplasty ; ITR[B]")).toEqual({
      code: "COMBO", overrides: { turb_inferior_right: true, turb_inferior_left: true },
    });
    expect(mapScheduleProcedure("Septoplasty ; ITR[R]").overrides).toEqual({
      turb_inferior_right: true, turb_inferior_left: false,
    });
  });
  it("ESS·Septo가 없으면 지원 안 됨", () => {
    for (const t of ["TSA", "Endo T-P[L]", "T&A", "Total laryngectomy ; SND[B] ; Provox insertion ", ""]) {
      expect(mapScheduleProcedure(t).code).toBeNull();
    }
  });
  it("ESS가 다른 단어 안에 섞인 경우는 ESS로 보지 않는다", () => {
    expect(mapScheduleProcedure("Explorative tympanotomy[L]").code).toBeNull();
  });
});

describe("parseScheduleAge", () => {
  it.each([["41Y", 41], ["6Y1M", 6], ["10Y6M", 10], ["16M", 0], ["30M", 0], [" 67Y ", 67], ["", null], ["?", null]])(
    "%s → %s", (input, expected) => expect(parseScheduleAge(input)).toBe(expected),
  );
});

describe("buildImportPlanData", () => {
  it("엑셀 Septoturbinoplasty는 사이트 수술명도 Septoturbinoplasty", () => {
    const m = mapScheduleProcedure("Septoturbinoplasty[R]");
    expect(buildProcedureName("SEPTOPLASTY", buildImportPlanData({ ...m, code: "SEPTOPLASTY" }))).toBe("Septoturbinoplasty");
  });
  it("엑셀 Septoplasty는 사이트 수술명도 Septoplasty (기본값 Inferior 체크를 끔)", () => {
    const m = mapScheduleProcedure("Septoplasty");
    expect(buildProcedureName("SEPTOPLASTY", buildImportPlanData({ ...m, code: "SEPTOPLASTY" }))).toBe("Septoplasty");
  });
  it("COMBO + Septoturbinoplasty는 Septoturbinoplasty로 시작", () => {
    const m = mapScheduleProcedure("Septoturbinoplasty ; ESS[B]");
    expect(buildProcedureName("COMBO", buildImportPlanData({ ...m, code: "COMBO" }))).toMatch(/^Septoturbinoplasty/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/schedule-import.test.ts`
Expected: FAIL — `Cannot find module './schedule-import'`

- [ ] **Step 3: 구현** `src/lib/schedule-import.ts`

```ts
import { applyFieldDefaults, type FieldValues } from "@/lib/field-types";
import { resolveSurgeryTypeFields } from "@/lib/op-note-defs";

export type ImportSurgeryCode = "ESS" | "SEPTOPLASTY" | "COMBO";

export interface ProcedureMapping {
  code: ImportSurgeryCode | null;
  overrides: FieldValues;
}

// 스케줄 엑셀의 수술 칸("ESS[B] ; Septoplasty ; ITR[B]")을 사이트 수술 종류와
// 미리 켜둘 체크 항목으로 바꾼다. 규칙(사용자 확정): 엑셀 Septoturbinoplasty는
// 괄호와 상관없이 Septoplasty + Inferior turbinoplasty 양측이다.
export function mapScheduleProcedure(text: string): ProcedureMapping {
  const tokens = text.split(";").map((t) => t.trim()).filter(Boolean);
  let ess = false;
  let septo = false;
  let right = false;
  let left = false;
  let touchedInferior = false;

  for (const token of tokens) {
    const side = /\[([RLB])\]/i.exec(token)?.[1]?.toUpperCase();
    const name = token.replace(/\[.*?\]/g, "").trim();
    if (/^f?ess$/i.test(name)) ess = true;
    else if (/^septoturbinoplasty$/i.test(name)) {
      septo = true;
      right = left = touchedInferior = true;
    } else if (/^septoplasty$/i.test(name)) {
      septo = true;
      touchedInferior = true;
    } else if (/^itr$/i.test(name)) {
      touchedInferior = true;
      if (side === "R" || side === "B" || !side) right = true;
      if (side === "L" || side === "B" || !side) left = true;
    }
  }

  const code: ImportSurgeryCode | null = ess && septo ? "COMBO" : ess ? "ESS" : septo ? "SEPTOPLASTY" : null;
  const overrides: FieldValues = code && touchedInferior ? { turb_inferior_right: right, turb_inferior_left: left } : {};
  return { code, overrides };
}

// "41Y" → 41, "6Y1M" → 6, "16M" → 0 (개월만 있으면 0세)
export function parseScheduleAge(text: string): number | null {
  const t = text.trim();
  const years = /^(\d+)Y/i.exec(t);
  if (years) return Number(years[1]);
  if (/^\d+M$/i.test(t)) return 0;
  return null;
}

// 해당 수술 종류의 필드 기본값 위에 엑셀에서 읽은 값만 덮어쓴다.
export function buildImportPlanData(mapping: { code: ImportSurgeryCode; overrides: FieldValues }): FieldValues {
  const fields = resolveSurgeryTypeFields({ code: mapping.code, fields: [] });
  return { ...applyFieldDefaults({}, fields), ...mapping.overrides };
}
```

주의: ESS 단독에는 `overrides`가 비어 ESS 기본값(Inferior 없음)이 유지된다. `ESS ; ITR[B]`는 ESS + Inferior 양측(ESS 필드에도 turbinoplastyFields 있음).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/schedule-import.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule-import.ts src/lib/schedule-import.test.ts
git commit -m "feat: 스케줄 엑셀 수술 칸 → 사이트 수술 종류/체크 항목 매핑"
```

---

### Task 3: 엑셀 → 내 행 파싱

**Files:**
- Modify: `package.json` (`exceljs` 추가)
- Create: `src/lib/schedule-workbook.ts`
- Test: `src/lib/schedule-workbook.test.ts`

**Interfaces:**
- Consumes: `exceljs`
- Produces:
  - `interface ScheduleRow { date: string /* YYYY-MM-DD */; room: string; order: string; surgeon: string; assist: string; chartNo: string; name: string; sex: string; age: string; diagnosis: string; procedure: string; anesthesia: string; duration: string; note: string }`
  - `class ScheduleFormatError extends Error`
  - `parseScheduleWorkbook(data: ArrayBuffer, surgeonName: string): Promise<ScheduleRow[]>` — 해당 교수님 행만 반환. 헤더 없으면/xlsx 아니면 `ScheduleFormatError`.

- [ ] **Step 1: 의존성**

```bash
npm install exceljs@4.4.0
```

- [ ] **Step 2: 실패하는 테스트** — 가상 데이터로 워크북을 만든다

```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseScheduleWorkbook, ScheduleFormatError } from "./schedule-workbook";

const HEADER = ["날짜", "요일", "Room", "순번", "교수님", "assist", "등록번호", "성명", "성별", "나이", " 진단", "수술", "마취", "예상소요시간"];

// 실제 스케줄과 같은 모양(제목 1행, 빈 2행, 헤더 3행, 날짜는 그날 첫 행에만)의 가상 데이터
async function workbook(rows: unknown[][], opts: { wide?: boolean } = {}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("7월7주");
  ws.getCell("K1").value = "★ ENT 수술 스케줄 ★";
  ws.getRow(3).values = HEADER;
  rows.forEach((r, i) => (ws.getRow(4 + i).values = r));
  if (opts.wide) ws.getCell("XFD54").value = " ";
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const row = (date: unknown, surgeon: string, procedure: string, extra: Partial<Record<string, string>> = {}) => [
  date, "", "Room23", "1", surgeon, "R2D", extra.chartNo ?? "900000001", extra.name ?? "테스트", "M", "41Y", "CRS[B]", procedure, "전신", "02 : 30", extra.note ?? "",
];

describe("parseScheduleWorkbook", () => {
  it("교수님이 같은 행만, 날짜는 아래로 채워서", async () => {
    const data = await workbook([
      row("2026-10-12", "다른교수", "T&A"),
      row(null, "정일구", "ESS[B]", { chartNo: "900000002" }),
      row("2026-10-16", "다른교수", "ESS[B]"),
      row(null, "정일구", "Septoplasty ; ESS[B]", { chartNo: "900000003", note: "당일" }),
    ]);
    const rows = await parseScheduleWorkbook(data, "정일구");
    expect(rows.map((r) => [r.date, r.chartNo, r.procedure])).toEqual([
      ["2026-10-12", "900000002", "ESS[B]"],
      ["2026-10-16", "900000003", "Septoplasty ; ESS[B]"],
    ]);
    expect(rows[1]).toMatchObject({ room: "Room23", order: "1", assist: "R2D", sex: "M", age: "41Y", diagnosis: "CRS[B]", anesthesia: "전신", duration: "02 : 30", note: "당일" });
  });

  it("이름 앞뒤 공백은 무시한다", async () => {
    const data = await workbook([row("2026-10-12", "정일구 ", "ESS[B]")]);
    expect(await parseScheduleWorkbook(data, " 정일구")).toHaveLength(1);
  });

  it("다른 교수님 행은 결과에 전혀 없다", async () => {
    const data = await workbook([row("2026-10-12", "다른교수", "ESS[B]", { name: "비밀환자" })]);
    const rows = await parseScheduleWorkbook(data, "정일구");
    expect(JSON.stringify(rows)).not.toContain("비밀환자");
  });

  it("Date 셀도 YYYY-MM-DD로 읽는다", async () => {
    const data = await workbook([row(new Date(Date.UTC(2026, 9, 14)), "정일구", "ESS[B]")]);
    expect((await parseScheduleWorkbook(data, "정일구"))[0].date).toBe("2026-10-14");
  });

  it("날짜가 나오기 전 행은 버린다", async () => {
    const data = await workbook([row(null, "정일구", "ESS[B]"), row("2026-10-13", "정일구", "ESS[L]")]);
    expect((await parseScheduleWorkbook(data, "정일구")).map((r) => r.date)).toEqual(["2026-10-13"]);
  });

  it("범위가 XFD까지 넓은 시트도 빨리 읽는다", async () => {
    const data = await workbook([row("2026-10-16", "정일구", "ESS[B]")], { wide: true });
    const t = Date.now();
    expect(await parseScheduleWorkbook(data, "정일구")).toHaveLength(1);
    expect(Date.now() - t).toBeLessThan(2000);
  });

  it("헤더가 없으면 ScheduleFormatError", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("x").getCell("A1").value = "hello";
    const data = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(parseScheduleWorkbook(data, "정일구")).rejects.toBeInstanceOf(ScheduleFormatError);
  });

  it("xlsx가 아니면 ScheduleFormatError", async () => {
    await expect(parseScheduleWorkbook(new TextEncoder().encode("not excel").buffer as ArrayBuffer, "정일구")).rejects.toBeInstanceOf(ScheduleFormatError);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/schedule-workbook.test.ts`
Expected: FAIL — `Cannot find module './schedule-workbook'`

- [ ] **Step 4: 구현** `src/lib/schedule-workbook.ts`

```ts
import ExcelJS from "exceljs";

export interface ScheduleRow {
  date: string;
  room: string;
  order: string;
  surgeon: string;
  assist: string;
  chartNo: string;
  name: string;
  sex: string;
  age: string;
  diagnosis: string;
  procedure: string;
  anesthesia: string;
  duration: string;
  note: string;
}

export class ScheduleFormatError extends Error {}

const COLUMNS: Record<Exclude<keyof ScheduleRow, "note">, string> = {
  date: "날짜", room: "Room", order: "순번", surgeon: "교수님", assist: "assist", chartNo: "등록번호",
  name: "성명", sex: "성별", age: "나이", diagnosis: "진단", procedure: "수술", anesthesia: "마취", duration: "예상소요시간",
};
const HEADER_SCAN_ROWS = 20;
const HEADER_SCAN_COLS = 40;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "richText" in value) return value.richText.map((r) => r.text).join("").trim();
  if (typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue);
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  return String(value).trim();
}

function toIsoDate(text: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}

// 주간 수술 스케줄 엑셀에서 surgeonName 교수님 행만 뽑는다. 시트 이름·헤더 위치는
// 주마다 다를 수 있어 헤더 텍스트로 열을 찾고, 날짜는 그날 첫 행에만 있어 아래로 채운다.
// 시트 범위가 XFD(16384열)까지 잡혀 있는 파일이 있어 찾은 열만 읽는다.
export async function parseScheduleWorkbook(data: ArrayBuffer, surgeonName: string): Promise<ScheduleRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(data) as unknown as ExcelJS.Buffer);
  } catch {
    throw new ScheduleFormatError("엑셀(xlsx) 파일이 아닙니다.");
  }
  const target = surgeonName.trim();

  for (const ws of wb.worksheets) {
    let headerRow = 0;
    const col: Partial<Record<keyof ScheduleRow, number>> = {};
    for (let r = 1; r <= Math.min(HEADER_SCAN_ROWS, ws.rowCount) && !headerRow; r++) {
      const row = ws.getRow(r);
      const found: Partial<Record<keyof ScheduleRow, number>> = {};
      for (let c = 1; c <= HEADER_SCAN_COLS; c++) {
        const text = cellText(row.getCell(c).value);
        for (const [key, label] of Object.entries(COLUMNS)) if (text === label) found[key as keyof ScheduleRow] = c;
      }
      if (found.surgeon && found.procedure && found.date) {
        headerRow = r;
        Object.assign(col, found);
        col.note = Math.max(...Object.values(found)) + 1; // 헤더 없는 비고 칸(예: "당일 11:00-13:00")
      }
    }
    if (!headerRow) continue;

    const rows: ScheduleRow[] = [];
    let currentDate: string | null = null;
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (key: keyof ScheduleRow) => (col[key] ? cellText(row.getCell(col[key]!).value) : "");
      currentDate = toIsoDate(get("date")) ?? currentDate;
      if (!currentDate || get("surgeon") !== target) continue;
      rows.push({
        date: currentDate, room: get("room"), order: get("order"), surgeon: get("surgeon"), assist: get("assist"),
        chartNo: get("chartNo"), name: get("name"), sex: get("sex"), age: get("age"), diagnosis: get("diagnosis"),
        procedure: get("procedure"), anesthesia: get("anesthesia"), duration: get("duration"), note: get("note"),
      });
    }
    return rows;
  }
  throw new ScheduleFormatError("수술 스케줄 형식(교수님·수술 칸)을 찾지 못했습니다.");
}
```

헤더 텍스트는 `cellText`가 trim하므로 `" 진단"`도 `"진단"`과 일치한다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/schedule-workbook.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/schedule-workbook.ts src/lib/schedule-workbook.test.ts
git commit -m "feat: 주간 수술 스케줄 엑셀에서 내 행만 읽기"
```

---

### Task 4: 미리보기·생성 서버 액션

**Files:**
- Create: `src/app/actions/schedule-import.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `parseScheduleWorkbook`, `ScheduleFormatError`, `ScheduleRow` (Task 3); `mapScheduleProcedure`, `parseScheduleAge`, `buildImportPlanData`, `ImportSurgeryCode` (Task 2); `getCurrentUser` (`@/lib/dal`), `prisma`
- Produces:
  - `type PreviewStatus = "new" | "exists" | "unsupported"`
  - `interface PreviewRow extends ScheduleRow { code: ImportSurgeryCode | null; status: PreviewStatus }`
  - `interface PreviewState { rows?: PreviewRow[]; message?: string }`
  - `previewSchedule(prev: PreviewState | undefined, formData: FormData): Promise<PreviewState>` — `formData.get("file")`
  - `importSchedule(rows: ScheduleRow[]): Promise<{ created: number; skipped: number; message?: string }>`

- [ ] **Step 1: body 한도** — `next.config.ts`

```ts
const nextConfig: NextConfig = {
  // 주간 수술 스케줄 엑셀(약 1.3MB)이 Server Action 기본 한도 1MB를 넘는다.
  // Vercel 함수 요청 한도(4.5MB) 안쪽으로 잡는다.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
```

- [ ] **Step 2: 구현** `src/app/actions/schedule-import.ts`

```ts
"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseScheduleWorkbook, ScheduleFormatError, type ScheduleRow } from "@/lib/schedule-workbook";
import { buildImportPlanData, mapScheduleProcedure, parseScheduleAge, type ImportSurgeryCode } from "@/lib/schedule-import";

export type PreviewStatus = "new" | "exists" | "unsupported";
export interface PreviewRow extends ScheduleRow {
  code: ImportSurgeryCode | null;
  status: PreviewStatus;
}
export interface PreviewState {
  rows?: PreviewRow[];
  message?: string;
}

// 같은 환자(등록번호) + 같은 날짜 + 같은 수술 종류 계획이 이미 있는지
async function existingPlan(userId: string, chartNo: string, date: string, code: ImportSurgeryCode) {
  return prisma.opPlan.findFirst({
    where: {
      createdById: userId,
      plannedDate: new Date(date),
      surgeryType: { code },
      patient: { chartNo, createdById: userId },
    },
    select: { id: true },
  });
}

export async function previewSchedule(_prev: PreviewState | undefined, formData: FormData): Promise<PreviewState> {
  const user = await getCurrentUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "엑셀 파일을 고르세요." };

  let rows: ScheduleRow[];
  try {
    rows = await parseScheduleWorkbook(await file.arrayBuffer(), user.name);
  } catch (e) {
    if (e instanceof ScheduleFormatError) return { message: e.message };
    throw e;
  }
  console.info(`[schedule-import] preview rows=${rows.length}`);

  const preview = await Promise.all(
    rows.map(async (row): Promise<PreviewRow> => {
      const { code } = mapScheduleProcedure(row.procedure);
      if (!code) return { ...row, code, status: "unsupported" };
      const exists = row.chartNo && (await existingPlan(user.id, row.chartNo, row.date, code));
      return { ...row, code, status: exists ? "exists" : "new" };
    }),
  );
  return preview.length ? { rows: preview } : { rows: [], message: `${user.name} 교수님 수술이 이 파일에 없습니다.` };
}

const RowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  room: z.string(), order: z.string(), surgeon: z.string(), assist: z.string(),
  chartNo: z.string().min(1), name: z.string(), sex: z.string(), age: z.string(),
  diagnosis: z.string(), procedure: z.string(), anesthesia: z.string(), duration: z.string(), note: z.string(),
});

function planNoteOf(row: ScheduleRow): string {
  return [
    `스케줄: ${row.procedure}`,
    `${row.room} #${row.order} · assist ${row.assist}`,
    `마취 ${row.anesthesia} · 예상 ${row.duration}`,
    row.note && `비고 ${row.note}`,
  ].filter(Boolean).join("\n");
}

export async function importSchedule(input: ScheduleRow[]): Promise<{ created: number; skipped: number; message?: string }> {
  const user = await getCurrentUser();
  const parsed = z.array(RowSchema).safeParse(input);
  if (!parsed.success) return { created: 0, skipped: 0, message: "가져올 행 형식이 올바르지 않습니다." };

  const types = await prisma.surgeryType.findMany({ where: { code: { in: ["ESS", "SEPTOPLASTY", "COMBO"] } } });
  let created = 0;
  let skipped = 0;
  for (const row of parsed.data) {
    if (row.surgeon.trim() !== user.name.trim()) { skipped++; continue; }
    const mapping = mapScheduleProcedure(row.procedure);
    const type = mapping.code && types.find((t) => t.code === mapping.code);
    if (!mapping.code || !type || (await existingPlan(user.id, row.chartNo, row.date, mapping.code))) { skipped++; continue; }

    await prisma.$transaction(async (tx) => {
      const patient =
        (await tx.patient.findFirst({ where: { chartNo: row.chartNo, createdById: user.id } })) ??
        (await tx.patient.create({
          data: {
            chartNo: row.chartNo,
            name: row.name || row.chartNo,
            sex: row.sex === "M" || row.sex === "F" ? row.sex : null,
            age: parseScheduleAge(row.age),
            createdById: user.id,
          },
        }));
      await tx.opPlan.create({
        data: {
          patientId: patient.id,
          surgeryTypeId: type.id,
          plannedDate: new Date(row.date),
          diagnosis: row.diagnosis || null,
          planNote: planNoteOf(row),
          planData: buildImportPlanData({ code: mapping.code!, overrides: mapping.overrides }),
          status: "PLANNED",
          createdById: user.id,
        },
      });
    });
    created++;
  }
  console.info(`[schedule-import] created=${created} skipped=${skipped}`);
  revalidatePath("/patients");
  return { created, skipped };
}
```

- [ ] **Step 3: 소유자 검사·타입·린트**

Run: `npx vitest run src/lib/ownership-guard.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, 타입 에러 0, 린트 에러 0. (`prisma.opPlan.findFirst` 호출 창 안에 `createdById`가 있어야 함 — 위 코드는 포함)

- [ ] **Step 4: Commit**

```bash
git add next.config.ts src/app/actions/schedule-import.ts
git commit -m "feat: 스케줄 엑셀 미리보기·가져오기 서버 액션"
```

---

### Task 5: `/import` 화면 + 내비게이션 링크

**Files:**
- Create: `src/app/(app)/import/page.tsx`, `src/app/(app)/import/import-form.tsx`
- Modify: `src/components/app-nav-bar.tsx`

**Interfaces:**
- Consumes: `previewSchedule`, `importSchedule`, `PreviewRow`, `PreviewState` (Task 4)
- Produces: `/import` 라우트

- [ ] **Step 1: 페이지** `src/app/(app)/import/page.tsx`

```tsx
import { ImportForm } from "./import-form";

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">수술 스케줄 엑셀 가져오기</h1>
      <p className="text-sm text-slate-600">
        메일로 받은 주간 스케줄 엑셀을 올리면 내 이름으로 된 수술만 보여줍니다. 파일은 저장하지 않습니다.
      </p>
      <ImportForm />
    </div>
  );
}
```

- [ ] **Step 2: 클라이언트 폼** `src/app/(app)/import/import-form.tsx`

```tsx
"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { importSchedule, previewSchedule, type PreviewRow } from "@/app/actions/schedule-import";

const STATUS_LABEL: Record<PreviewRow["status"], string> = { new: "", exists: "이미 있음", unsupported: "지원 안 됨" };

export function ImportForm() {
  const [state, formAction, previewing] = useActionState(previewSchedule, undefined);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [importing, startImport] = useTransition();
  const rows = state?.rows ?? [];

  // 새 미리보기가 오면 "new" 행만 기본 체크
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setChecked(new Set(rows.flatMap((r, i) => (r.status === "new" ? [i] : []))));
    setResult(null);
  }

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function runImport() {
    startImport(async () => {
      // code/status는 서버 RowSchema(z.object)가 알아서 떼어낸다
      const selected = rows.filter((_, i) => checked.has(i));
      const r = await importSchedule(selected);
      setResult(r.message ?? `${r.created}건 만들었습니다${r.skipped ? ` (${r.skipped}건 건너뜀)` : ""}.`);
    });
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="file" name="file" accept=".xlsx" required className="text-sm" />
        <button type="submit" disabled={previewing} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {previewing ? "읽는 중…" : "미리보기"}
        </button>
      </form>
      {state?.message && <p className="text-sm text-amber-700">{state.message}</p>}

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr><th className="p-2"></th><th className="p-2">날짜</th><th className="p-2">Room</th><th className="p-2">환자</th><th className="p-2">진단</th><th className="p-2">수술</th><th className="p-2">사이트 종류</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b ${r.status === "new" ? "" : "text-slate-400"}`}>
                    <td className="p-2">
                      <input type="checkbox" aria-label={`${r.date} ${r.procedure} 가져오기`} disabled={r.status !== "new"} checked={checked.has(i)} onChange={() => toggle(i)} />
                    </td>
                    <td className="p-2 whitespace-nowrap">{r.date}</td>
                    <td className="p-2 whitespace-nowrap">{r.room} #{r.order}</td>
                    <td className="p-2 whitespace-nowrap">{r.name} {r.age} {r.sex}</td>
                    <td className="p-2">{r.diagnosis}</td>
                    <td className="p-2">{r.procedure}</td>
                    <td className="p-2">{r.code ?? "-"}</td>
                    <td className="p-2 whitespace-nowrap">{STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={runImport} disabled={importing || checked.size === 0} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
            {importing ? "만드는 중…" : `체크한 ${checked.size}건 수술 케이스 만들기`}
          </button>
        </>
      )}
      {result && (
        <p className="text-sm text-green-700">
          {result} <Link href="/patients" className="underline">환자 목록 보기</Link>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 내비게이션** — `app-nav-bar.tsx`의 `<PatientsNavLink />` 다음 줄에:

```tsx
          <Link href="/import" className="text-sm text-slate-600 hover:text-slate-900">
            엑셀 가져오기
          </Link>
```

- [ ] **Step 4: 전체 검사**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: 전부 PASS, 에러 0

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/import" src/components/app-nav-bar.tsx
git commit -m "feat: 수술 스케줄 엑셀 가져오기 화면"
```

---

### Task 6: 로컬 DB에서 실제 파일로 브라우저 검증

로컬에 Postgres가 없다(`.env.local`에 `DATABASE_URL` 없음, docker/psql 없음). **운영 DB로 테스트하지 않는다.**

- [ ] **Step 1: 로컬 Postgres (사용자 승인 후)**

```bash
brew install postgresql@16 && brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/createdb ess_septo_dev
```

`.env`(gitignore 확인)에 `DATABASE_URL=postgresql://$USER@localhost:5432/ess_septo_dev`, `SESSION_SECRET=$(openssl rand -base64 32)`, `ALLOWED_EMAILS=<테스트 이메일>`.

```bash
npx prisma migrate deploy && npx tsx prisma/seed.ts
```

- [ ] **Step 2: dev 서버 + 가입** — `.claude/launch.json`에 `npm run dev`(3000) 등록 후 preview_start. 이름 "정일구"로 테스트 계정 가입(테스트 값은 `.env.example` 주석이 아니라 로컬 `.env`에만).

- [ ] **Step 3: 시나리오 확인** (실제 `~/Downloads/ENT수술_2026_10월 3주차.xlsx`)
  - `/import` 업로드 → 미리보기 1행: 2026-10-16, Room23 #1, CRS[B], ESS[B], 종류 ESS, 체크됨.
  - "1건 수술 케이스 만들기" → "1건 만들었습니다" → 환자 목록에 환자 1명, 계획 화면 날짜 10/16·진단 CRS[B]·메모에 스케줄 원문.
  - 같은 파일 다시 업로드 → 상태 "이미 있음", 체크 불가.
  - 엑셀 아닌 파일 업로드 → 안내 메시지(500 아님).
  - 콘솔 에러 0, 서버 로그에 환자 정보 없이 건수만.

- [ ] **Step 4: Septoturbinoplasty 화면 확인** — 가상 데이터 엑셀(Task 3 테스트 헬퍼와 같은 방식, `정일구` + `Septoturbinoplasty[R]`, `Septoplasty ; ESS[B] ; ITR[B]`)을 스크래치에서 만들어 올리고, 계획 화면 수술명이 각각 "Septoturbinoplasty", "Septoturbinoplasty + …ESS…"인지 확인.

- [ ] **Step 5: 마무리** — superpowers:finishing-a-development-branch (PR 생성 여부는 사용자 결정).
