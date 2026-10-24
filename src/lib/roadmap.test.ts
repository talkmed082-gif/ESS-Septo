import { describe, expect, it } from "vitest";
import { carryDone, todoItems, VisitNoteBodySchema, RoadmapUpdateBodySchema } from "./roadmap";

describe("로드맵 할 일", () => {
  it("한 줄에 여러 □, 줄바꿈된 □ 모두 나눈다", () => {
    const t = "경과: 9/10 초진\n할 일: □ Lt myringotomy 결정 □ 9/10 검사 결과 확인\n□ 보청기 진행 확인\n확인: 기록 없음";
    expect(todoItems(t)).toEqual(["Lt myringotomy 결정", "9/10 검사 결과 확인", "보청기 진행 확인"]);
  });
  it("새 판에서도 같은 글의 할 일은 체크를 이어 가고, 없어진 할 일은 버린다", () => {
    expect(carryDone(["A 확인", "B 결정"], "할 일: □ A 확인 □ C 시행")).toEqual(["A 확인"]);
  });
  it("입력 형식: 등록번호 숫자, 기록 종류 first/follow", () => {
    expect(VisitNoteBodySchema.safeParse({ chartNo: "12345678", kind: "follow", text: "S: f/u" }).success).toBe(true);
    expect(VisitNoteBodySchema.safeParse({ chartNo: "x", kind: "follow", text: "a" }).success).toBe(false);
    expect(VisitNoteBodySchema.safeParse({ chartNo: "12345678", kind: "other", text: "a" }).success).toBe(false);
    expect(RoadmapUpdateBodySchema.parse({ items: [{ chartNo: "12345678", text: "경과: a" }] }).items[0].noteIds).toEqual([]);
  });
});
