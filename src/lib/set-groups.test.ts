import { describe, expect, it } from "vitest";
import { groupClinicSets } from "./set-groups";

const s = (path: string, name: string) => ({ key: name, name, path, ownerEmpNo: "1" });
describe("groupClinicSets", () => {
  it("코 외래 폴더만, 성인/소아 · 약/오더로", () => {
    const g = groupClinicSets([
      s("개인SET › ☆ 비과 _ 외래진료", "Allergic Rhinitis"),
      s("개인SET › ☆ 비과 _ 외래진료", "비과외래 알레르기검사"),
      s("개인SET › ☆ 비과 _ 외래진료", "비과  소아약"),
      s("개인SET › ☆ 비과 _ 외래진료", "☆ 소아 비과 환자 (25kg)"),
      s("개인SET › ★ 소아 외래 › 소아 비과", "소아 AR (2-5세)"),
      s("개인SET › ★ 소아 외래 › 소아 비과", "소아 AR 검사"),
      s("개인SET › ☆ 이과 _ 외래진료", "Tinnitus"),
    ]);
    expect(g.adultRx.map((x) => x.name)).toEqual(["Allergic Rhinitis"]);
    expect(g.adultOrders.map((x) => x.name)).toEqual(["비과외래 알레르기검사"]);
    expect(g.childRx.map((x) => x.name)).toEqual(["비과  소아약", "소아 AR (2-5세)"]);
    expect(g.childOrders.map((x) => x.name)).toEqual(["☆ 소아 비과 환자 (25kg)", "소아 AR 검사"]);
  });
});
