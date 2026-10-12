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
      turb_inferior_right: true,
      turb_inferior_left: true,
    });
  });

  it("ITR[side]는 해당 측 Inferior를 켠다", () => {
    expect(mapScheduleProcedure("ESS[B] ; Septoplasty ; ITR[B]")).toEqual({
      code: "COMBO",
      overrides: { turb_inferior_right: true, turb_inferior_left: true },
    });
    expect(mapScheduleProcedure("Septoplasty ; ITR[R]").overrides).toEqual({
      turb_inferior_right: true,
      turb_inferior_left: false,
    });
  });

  it("ESS·Septo가 없으면 지원 안 됨", () => {
    for (const t of ["TSA", "Endo T-P[L]", "T&A", "Total laryngectomy ; SND[B] ; Provox insertion ", ""]) {
      expect(mapScheduleProcedure(t).code).toBeNull();
    }
  });

  it("ESS가 다른 단어 안에 섞인 경우는 ESS로 보지 않는다", () => {
    expect(mapScheduleProcedure("Explorative tympanotomy[L]").code).toBeNull();
    expect(mapScheduleProcedure("Excess tissue removal").code).toBeNull();
  });
});

describe("parseScheduleAge", () => {
  it.each([
    ["41Y", 41],
    ["6Y1M", 6],
    ["10Y6M", 10],
    ["16M", 0],
    ["30M", 0],
    [" 67Y ", 67],
    ["", null],
    ["?", null],
  ] as const)("%s → %s", (input, expected) => expect(parseScheduleAge(input)).toBe(expected));
});

describe("buildImportPlanData", () => {
  it("엑셀 Septoturbinoplasty는 사이트 수술명도 Septoturbinoplasty", () => {
    const m = mapScheduleProcedure("Septoturbinoplasty[R]");
    expect(buildProcedureName("SEPTOPLASTY", buildImportPlanData({ ...m, code: "SEPTOPLASTY" }))).toBe(
      "Septoturbinoplasty",
    );
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
