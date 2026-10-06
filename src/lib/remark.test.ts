import { describe, expect, it } from "vitest";
import { buildRemarkText } from "./remark";

describe("buildRemarkText", () => {
  it("CC · 수술명 · 수술 후 특이사항을 한 줄씩 묶는다", () => {
    expect(
      buildRemarkText({
        chiefComplaint: "코막힘, 후비루",
        surgeryDate: "2026-10-06",
        procedureName: "Septoturbinoplasty + Bil. ESS",
        postOpRemark: "Rt. lamina papyracea 일부 노출, 지혈 확인",
      }),
    ).toBe(
      [
        "CC : 코막힘, 후비루",
        "Op : 2026-10-06 Septoturbinoplasty + Bil. ESS",
        "수술 후 특이사항 : Rt. lamina papyracea 일부 노출, 지혈 확인",
      ].join("\n"),
    );
  });

  it("비어 있는 항목은 줄째로 뺀다", () => {
    expect(buildRemarkText({ chiefComplaint: "  ", procedureName: "Septoplasty", postOpRemark: "" })).toBe(
      "Op : Septoplasty",
    );
    expect(buildRemarkText({})).toBe("");
  });

  it("여러 줄 특이사항은 머리말 다음 줄부터 이어 붙인다", () => {
    expect(buildRemarkText({ chiefComplaint: "코막힘", postOpRemark: "출혈 많음\nMerocel 유지" })).toBe(
      "CC : 코막힘\n수술 후 특이사항 :\n출혈 많음\nMerocel 유지",
    );
  });
});
