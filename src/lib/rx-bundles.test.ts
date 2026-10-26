import { describe, expect, it } from "vitest";
import { calcPedItem, daysUntilVisit, DEFAULT_ADULT_RX, DEFAULT_CHILD_RX, RxBundleInputSchema, withVisitDays, type CalcResult } from "./rx-bundles";

const child = (title: string) => DEFAULT_CHILD_RX.find((b) => b.title === title)!;

describe("처방 묶음 초안", () => {
  it("성인·소아 초안 모두 형식 통과", () => {
    for (const b of [...DEFAULT_ADULT_RX, ...DEFAULT_CHILD_RX]) expect(RxBundleInputSchema.safeParse(b).success).toBe(true);
  });
});

describe("소아 계산(KIMS 허가 용법·용량)", () => {
  const [ltirizin, avamys] = child("소아 AR").items;
  it("L-TIRIZIN 나이 구간: 1세 미만 안 씀, 1~2세 2.5ml qd, 2~6세 2.5ml bid, 6세 이상 10ml qd", () => {
    expect(calcPedItem(ltirizin, 8, 9).use).toBe(false);
    expect(calcPedItem(ltirizin, 18, 11)).toMatchObject({ dose: "2.5", freq: "P3", use: true });
    expect(calcPedItem(ltirizin, 48, 16)).toMatchObject({ dose: "2.5", freq: "P13" });
    expect(calcPedItem(ltirizin, 96, 25)).toMatchObject({ dose: "10", freq: "P3" });
  });
  it("AVAMYS 2세 미만 안 씀", () => {
    expect(calcPedItem(avamys, 20, 11).use).toBe(false);
    expect(calcPedItem(avamys, 30, 13).use).toBe(true);
  });
  it("AMOXCLAN NEO 90mg/kg/일 bid: 20kg → 7.5ml (KIMS 체중표와 같음), 40kg 이상·3개월 미만 안 씀, 몸무게 없으면 안 씀", () => {
    const amox = child("소아 급성 부비동염(아목시실린·클라불란산)").items[0];
    expect(calcPedItem(amox, 60, 20)).toMatchObject({ dose: "7.5", freq: "P13", use: true });
    expect(calcPedItem(amox, 36, 12)).toMatchObject({ dose: "4.5" });
    expect(calcPedItem(amox, 150, 40).use).toBe(false);
    expect(calcPedItem(amox, 2, 5).use).toBe(false);
    expect(calcPedItem(amox, 60, null)).toMatchObject({ use: false, why: "몸무게 필요" });
  });
  it("CLARIC 15mg/kg/일 bid, 1일 최대 1000mg", () => {
    const clr = child("소아 마크롤라이드(클래리트로마이신)").items[0];
    expect(calcPedItem(clr, 60, 20)).toMatchObject({ dose: "6" }); // 300mg/일 ÷ 2 ÷ 25mg/ml
    expect(calcPedItem(clr, 160, 80).dose).toBe("20"); // 1000mg 제한 → 500mg/회 = 20ml
  });
  it("ERDOLANT 체중 구간, 15kg 미만은 허가 용량 없음", () => {
    const erd = child("소아 기침·가래").items[1];
    expect(calcPedItem(erd, 48, 17)).toMatchObject({ dose: "5", freq: "P13" });
    expect(calcPedItem(erd, 84, 25)).toMatchObject({ dose: "5", freq: "P123" });
    expect(calcPedItem(erd, 30, 12).use).toBe(false);
  });
});

describe("외래까지 늘리기(기간과 따로)", () => {
  const item = (o: Partial<CalcResult>): CalcResult => ({ code: "X", name: "x", dose: "1", freq: "P1", days: "14", untilVisit: false, use: true, why: "", ...o });
  it("다음 외래까지 일수(오늘 10/27 → 11/13 = 17일), 지났거나 없으면 null", () => {
    expect(daysUntilVisit("2026-10-27", "2026-11-13")).toBe(17);
    expect(daysUntilVisit("2026-10-27", "2026-10-27")).toBeNull();
    expect(daysUntilVisit("2026-10-27", null)).toBeNull();
    expect(daysUntilVisit("2026-10-27", "11/13")).toBeNull();
  });
  it("외래까지 켠 약만 늘리고, 항생제처럼 끈 약·안 쓰는 약은 정해진 기간 그대로", () => {
    const out = withVisitDays([item({ code: "A", untilVisit: true }), item({ code: "B", days: "7" }), item({ code: "C", untilVisit: true, use: false })], "2026-10-27", "2026-11-13");
    expect(out.map((i) => `${i.code}:${i.days}`)).toEqual(["A:17", "B:7", "C:14"]);
    expect(out[0].why).toMatch(/다음 외래\(2026-11-13\)까지 17일/);
  });
  it("다음 외래를 안 골랐으면 아무것도 안 바꿈", () => {
    expect(withVisitDays([item({ untilVisit: true })], "2026-10-27", undefined)[0].days).toBe("14");
  });
  it("예전에 저장된 약(untilVisit 없음)은 꺼진 것으로", () => {
    const p = RxBundleInputSchema.safeParse({ title: "t", audience: "adult", sortOrder: 1, items: [{ code: "A", name: "a", days: "14" }] });
    expect(p.success && p.data.items[0].untilVisit).toBe(false);
  });
});