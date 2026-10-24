import { describe, expect, it } from "vitest";
import { surgeryOrdersFor } from "./surgery-orders";

const codes = (o: ReturnType<typeof surgeryOrdersFor>) => o.map((x) => `${x.code}${x.side ? " " + x.side : ""}`);

describe("수술기록 → EMR 수술 오더", () => {
  it("양측 상악+사골(용종·재수술 없음) + 접구개 차단 기본 양측", () => {
    const v = { f_right_mma: true, f_right_ant_eth: true, f_left_mma: true, f_left_post_eth: true };
    expect(codes(surgeryOrdersFor("ESS", v))).toEqual(["O1141 Rt.", "O1141 Lt.", "LA235 Rt.", "LA235 Lt."]);
  });

  it("접형·전두를 하면 복잡, 재수술·용종도 복잡(복잡 코드가 있는 조합만)", () => {
    const v = { f_right_mma: true, f_right_ant_eth: true, f_right_sphenoid: true, f_left_ant_eth: true, f_left_frontal: true, o_spg_block: "안 함" };
    const o = surgeryOrdersFor("ESS", v);
    expect(codes(o)).toEqual(["O1152 Rt.", "O1162 Lt."]);
    expect(o[0].why).toBe("접형·전두");
    // 상악+사골은 복잡 코드가 없어 용종이 있어도 O1141
    expect(codes(surgeryOrdersFor("ESS", { f_right_mma: true, f_right_ant_eth: true, n_polyp_right_site_mm: true, o_spg_block: "안 함" }))).toEqual(["O1141 Rt."]);
  });

  it("네 곳 모두 → 전부비강(O1131), 상악+접형 → 두 줄", () => {
    const all = { f_right_mma: true, f_right_ant_eth: true, f_right_sphenoid: true, f_right_frontal: true, f_left_mma: true, f_left_sphenoid: true, o_spg_block: "안 함" };
    expect(codes(surgeryOrdersFor("ESS", all))).toEqual(["O1131 Rt.", "O1051 Lt.", "O1121 Lt."]);
  });

  it("비중격교정 기본 골(O1006), 연골 선택, 하비갑개 측마다, 네비게이션 한 번, 차단술 한쪽", () => {
    const v = { turb_inferior_right: true, turb_inferior_left: "true", turb_middle_left: true, f_nav: true, o_spg_block: "우측", f_right_ant_eth: true };
    expect(codes(surgeryOrdersFor("COMBO", v))).toEqual(["O1006", "O1101 Rt.", "O1022 Rt.", "O1022 Lt.", "ORIB994", "LA235 Rt."]);
    expect(codes(surgeryOrdersFor("SEPTOPLASTY", { o_septo_code: "연골 (O1005)", o_spg_block: "안 함" }))).toEqual(["O1005"]);
  });

  it("사골 없는 전두는 코드 없이 직접 확인 표시", () => {
    const o = surgeryOrdersFor("ESS", { f_right_frontal: true, o_spg_block: "안 함" });
    expect(o).toEqual([{ code: "", name: "전두동(사골동 없이) — 코드 없음, 직접 확인", side: "Rt." }]);
  });
});
