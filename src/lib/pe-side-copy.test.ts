import { describe, expect, it } from "vitest";
import { peSideCopyPatch } from "./pe-side-copy";

const KEYS = [
  "n_sinusitis_frontal_right",
  "n_sinusitis_frontal_left",
  "n_polyp_right_site_mm",
  "n_polyp_left_site_mm",
  "n_up_attach_right",
  "n_up_attach_left",
  "n_dev_side",
  "n_sinusitis_present",
  "n_only_right", // 짝 없는 칸
];

describe("peSideCopyPatch", () => {
  it("우측 → 좌측: 짝 칸에 값(체크·선택값)을 그대로 옮긴다", () => {
    const patch = peSideCopyPatch(
      KEYS,
      { n_sinusitis_frontal_right: true, n_polyp_right_site_mm: false, n_up_attach_right: "Lamina papyracea" },
      "right",
    );
    expect(patch).toEqual({
      n_sinusitis_frontal_left: true,
      n_polyp_left_site_mm: false,
      n_up_attach_left: "Lamina papyracea",
    });
  });

  it("좌측 → 우측도 같은 규칙(해제도 해제로 옮김), 값이 없는 칸은 건드리지 않는다", () => {
    expect(peSideCopyPatch(KEYS, { n_polyp_left_site_mm: true, n_sinusitis_frontal_left: false }, "left")).toEqual({
      n_sinusitis_frontal_right: false,
      n_polyp_right_site_mm: true,
    });
  });

  it("측 표기가 없는 칸과 짝 없는 칸은 건드리지 않는다", () => {
    const patch = peSideCopyPatch(KEYS, { n_dev_side: "우측", n_only_right: true }, "right");
    expect(patch).not.toHaveProperty("n_dev_side");
    expect(patch).not.toHaveProperty("n_only_left");
  });
});
