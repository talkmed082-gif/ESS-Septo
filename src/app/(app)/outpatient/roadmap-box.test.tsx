import { describe, expect, it } from "vitest";
import { splitRoadmap } from "./roadmap-box";

describe("splitRoadmap(할 일 뽑기)", () => {
  const text = ["요약: CRSwNP, 10/16 ESS 후", "경과: 9/1 CT", "현재: 술후 관찰", "할 일: □CT 재평가 □세척 교육", "  □스테로이드 끊기", "확인: 3개월 뒤"].join("\n");
  it("할 일 머리줄과 이어지는 줄의 □ 항목만 뽑고 나머지 줄은 그대로", () => {
    const r = splitRoadmap(text);
    expect(r.todo).toEqual(["CT 재평가", "세척 교육", "스테로이드 끊기"]);
    expect(r.rest).toEqual(["요약: CRSwNP, 10/16 ESS 후", "경과: 9/1 CT", "현재: 술후 관찰", "확인: 3개월 뒤"]);
  });
  it("진료 화면처럼 머리줄 없이 □ 항목만 와도 할 일로", () => {
    expect(splitRoadmap("□CT 재평가 □세척 교육")).toEqual({ todo: ["CT 재평가", "세척 교육"], rest: [] });
  });
  it("할 일이 없으면 빈 목록, 글은 전부 나머지", () => {
    expect(splitRoadmap("요약: x\n현재: y")).toEqual({ todo: [], rest: ["요약: x", "현재: y"] });
  });
});
