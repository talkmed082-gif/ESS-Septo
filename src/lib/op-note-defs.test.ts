import { describe, expect, it } from "vitest";
import {
  comboFullFields,
  essFindingFields,
  essFullFields,
  resolveSurgeryTypeFields,
  septoplastyFullFields,
  septumTurbinateFindingFields,
} from "./op-note-defs";
import { applyFieldDefaults, type SurgeryFieldDef } from "./field-types";

function keys(fields: SurgeryFieldDef[]): string[] {
  return fields.map((f) => f.key);
}

function defaultsOf(fields: SurgeryFieldDef[]) {
  return applyFieldDefaults({}, fields);
}

describe.each([
  ["ESS", essFullFields],
  ["SEPTOPLASTY", septoplastyFullFields],
  ["COMBO", comboFullFields],
])("%s 필드 정의", (_code, fields) => {
  it("같은 key가 두 번 나오지 않는다", () => {
    const all = keys(fields);
    expect(all.filter((k, i) => all.indexOf(k) !== i)).toEqual([]);
  });
});

describe("수술 종류별 기본값", () => {
  it("ESS 단독은 ESS P/E만 기본 체크하고 비중격 소견 그룹은 아예 없다", () => {
    const d = defaultsOf(essFullFields);
    expect(d.n_ess_pe_done).toBe(true);
    expect(keys(essFullFields)).not.toContain("n_septo_pe_done");
  });

  it("비중격교정술은 Septo P/E, 양측 CHR, 양측 하비갑개 축소술이 기본이고 dermacol 항목이 없다", () => {
    const d = defaultsOf(septoplastyFullFields);
    expect(d).toMatchObject({
      n_septo_pe_done: true,
      n_chr: "양측",
      turb_inferior_right: true,
      turb_inferior_left: true,
      s_incision_side: "좌측",
    });
    expect(keys(septoplastyFullFields)).not.toContain("dermacol");
  });

  it("병행은 두 P/E를 모두 기본 체크하고, ESS 전용 시행 순서(f_side_order)는 쓰지 않는다", () => {
    const d = defaultsOf(comboFullFields);
    expect(d).toMatchObject({ n_septo_pe_done: true, n_ess_pe_done: true, n_chr: "양측" });
    expect(keys(comboFullFields)).not.toContain("f_side_order");
    expect(keys(comboFullFields)).toContain("c_order");
  });

  it("기본값 override는 여러 수술 종류가 공유하는 원본 필드 정의를 건드리지 않는다", () => {
    expect(defaultsOf(septumTurbinateFindingFields)).toMatchObject({ n_chr: "없음" });
    expect(defaultsOf(septumTurbinateFindingFields).n_septo_pe_done).toBeUndefined();
    expect(defaultsOf(essFindingFields).n_ess_pe_done).toBeUndefined();
  });
});

describe("resolveSurgeryTypeFields", () => {
  it("기본 3종은 DB에 저장된 옛 필드 정의 대신 항상 코드의 최신 정의를 쓴다", () => {
    const stale = [{ key: "old_field", label: "옛 항목", type: "checkbox" }];
    expect(resolveSurgeryTypeFields({ code: "ESS", fields: stale })).toBe(essFullFields);
  });

  it("커스텀 수술 종류는 DB에 저장된 필드 정의를 쓴다", () => {
    const custom = [{ key: "x", label: "X", type: "text" }];
    expect(keys(resolveSurgeryTypeFields({ code: "TONSIL", fields: custom }))).toEqual(["x"]);
  });
});

describe("ESS의 DSN 필드", () => {
  it("ESS 단독에도 비중격 만곡 방향/정도 필드가 있고 기본값은 없음이다", () => {
    const d = defaultsOf(essFullFields);
    expect(d).toMatchObject({ n_dev_side: "특이 만곡 없음", n_deviation: "해당없음" });
    expect(keys(essFullFields)).not.toContain("n_septo_pe_done"); // Septo P/E 그룹 자체는 여전히 없음
  });

  it("병행/비중격교정술에서는 같은 key가 중복되지 않고 하나만 있다", () => {
    for (const fields of [comboFullFields, septoplastyFullFields]) {
      expect(keys(fields).filter((k) => k === "n_dev_side")).toHaveLength(1);
      expect(keys(fields).filter((k) => k === "n_deviation")).toHaveLength(1);
    }
  });
});

