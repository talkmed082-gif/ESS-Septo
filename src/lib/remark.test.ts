import { describe, expect, it } from "vitest";
import { buildRemarkText, ccSymptomSide, toggleCcSymptom } from "./remark";

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

describe("toggleCcSymptom", () => {
  it("없는 증상은 방향과 함께 맨 뒤에 붙인다", () => {
    expect(toggleCcSymptom("", "코막힘", "Rt.")).toBe("코막힘 (Rt.)");
    expect(toggleCcSymptom("코막힘 (Rt.)", "후비루")).toBe("코막힘 (Rt.), 후비루");
  });

  it("같은 증상·같은 방향을 다시 누르면 뺀다", () => {
    expect(toggleCcSymptom("코막힘 (Rt.), 후비루", "코막힘", "Rt.")).toBe("후비루");
    expect(toggleCcSymptom("후비루", "후비루")).toBe("");
  });

  it("방향만 다르면 그 자리에서 방향만 바꾼다", () => {
    expect(toggleCcSymptom("코막힘 (Rt.), 후비루", "코막힘", "Both")).toBe("코막힘 (Both), 후비루");
    expect(toggleCcSymptom("코막힘, 후비루", "코막힘", "Lt.")).toBe("코막힘 (Lt.), 후비루");
  });

  it("직접 적은 다른 내용은 그대로 둔다", () => {
    expect(toggleCcSymptom("3년 전부터 코막힘 악화", "후비루")).toBe("3년 전부터 코막힘 악화, 후비루");
  });

  it("ccSymptomSide로 지금 들어가 있는 방향을 읽는다", () => {
    expect(ccSymptomSide("코막힘 (Rt.), 후비루", "코막힘")).toBe("Rt.");
    expect(ccSymptomSide("코막힘 (Rt.), 후비루", "후비루")).toBe("");
    expect(ccSymptomSide("코막힘 (Rt.)", "두통")).toBeUndefined();
  });
});
