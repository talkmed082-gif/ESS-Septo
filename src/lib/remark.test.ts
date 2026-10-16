import { describe, expect, it } from "vitest";
import { buildRemarkText, ccSymptomSide, remarkExtras, removeCcSymptom, setCcSymptomSide, toggleCcSymptom } from "./remark";

describe("buildRemarkText", () => {
  it("'~ 증상 있어 M월 D일 수술명 시행함, 덧붙임, 특이사항.' 한 문장으로 묶는다", () => {
    expect(
      buildRemarkText({
        chiefComplaint: "코막힘, 후비루",
        surgeryDate: "2026-10-16",
        procedureName: "Septoturbinoplasty + Both ESS",
        postOpRemark: "Rt. lamina papyracea 일부 노출, 지혈 확인",
        extras: remarkExtras({ f_silastic_sheet: true }),
      }),
    ).toBe(
      "코막힘, 후비루 증상 있어 10월 16일 Septoturbinoplasty + Both ESS 시행함, silastic sheet insertion 함, 1주일~10일 사이에 silastic sheet 제거해야함, Rt. lamina papyracea 일부 노출, 지혈 확인.",
    );
  });

  it("비어 있는 부분은 문장에서 빼고, 특이사항 끝의 마침표는 겹치지 않게", () => {
    expect(buildRemarkText({ chiefComplaint: "  ", procedureName: "Septoplasty", postOpRemark: "" })).toBe(
      "Septoplasty 시행함.",
    );
    expect(buildRemarkText({ surgeryDate: "2026-10-16", procedureName: "Both ESS", postOpRemark: "특이 없음." })).toBe(
      "10월 16일 Both ESS 시행함, 특이 없음.",
    );
    expect(buildRemarkText({})).toBe("");
    expect(remarkExtras({ f_silastic_sheet: false })).toEqual([]);
    expect(remarkExtras({ s_splint: true })).toHaveLength(2);
  });

  it("여러 줄 특이사항은 문장 다음 줄부터 그대로 붙인다", () => {
    expect(
      buildRemarkText({ chiefComplaint: "코막힘", procedureName: "Both ESS", postOpRemark: "출혈 많음\nMerocel 유지" }),
    ).toBe("코막힘 증상 있어 Both ESS 시행함.\n출혈 많음\nMerocel 유지");
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

describe("removeCcSymptom / setCcSymptomSide", () => {
  it("증상만 빼고 직접 적은 내용은 둔다", () => {
    expect(removeCcSymptom("코막힘 (Rt.), 3년 전부터 악화, 후비루", "코막힘")).toBe("3년 전부터 악화, 후비루");
  });
  it("방향을 바꾸거나 지우고, 없는 증상이면 붙인다", () => {
    expect(setCcSymptomSide("코막힘 (Rt.), 후비루", "코막힘", "Both")).toBe("코막힘 (Both), 후비루");
    expect(setCcSymptomSide("코막힘 (Rt.)", "코막힘")).toBe("코막힘");
    expect(setCcSymptomSide("후비루", "Foul odor", "Lt.")).toBe("후비루, Foul odor (Lt.)");
  });
});
