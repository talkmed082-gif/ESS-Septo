import { describe, expect, it, vi } from "vitest";

const { askJev } = vi.hoisted(() => ({ askJev: vi.fn() }));
vi.mock("@/lib/jev", () => ({ askJev, choice: (i: unknown, c: unknown) => ({ type: "choice", instructions: i, criteria: c }) }));

import { classifyConsultField, ruleField } from "@/lib/consult-field";

describe("ruleField", () => {
  it("어지럼증 의뢰는 귀", () => {
    expect(ruleField("어지럼증, 구토 동반. dizziness 평가 부탁드립니다")?.field).toBe("ear");
  });
  it("코피·비중격은 코", () => {
    expect(ruleField("지속되는 코피로 비중격 확인 부탁")?.field).toBe("nose");
  });
  it("갑상선 결절·쉰 목소리는 두경부", () => {
    expect(ruleField("갑상선 결절, 수술 후 쉰 목소리")?.field).toBe("headneck");
  });
  it("귀가·코로나 같은 말은 걸리지 않는다", () => {
    expect(ruleField("귀가 예정 환자, 코로나 음성")).toBeNull();
  });
  it("혀 병변은 두경부(한글 낱말 경계)", () => {
    expect(ruleField("혀 궤양 평가 부탁드립니다")?.field).toBe("headneck");
  });
  it("이상한 입력에도 죽지 않는다(빈 글·이모지·스크립트·아주 긴 글)", () => {
    expect(ruleField("")).toBeNull();
    expect(ruleField("🙏🙏 </script><script>alert(1)</script>")).toBeNull();
    expect(ruleField("어지럼 ".repeat(5000))?.field).toBe("ear");
  });
  it("영어 대소문자 섞여도 걸린다", () => {
    expect(ruleField("EPISTAXIS, recurrent")?.field).toBe("nose");
    expect(ruleField("Vertigo with Nystagmus")?.field).toBe("ear");
  });
  it("분야가 섞여 비슷하면 규칙으로 정하지 않는다", () => {
    expect(ruleField("비염 있고 이명도 있음")).toBeNull();
  });
});

describe("classifyConsultField", () => {
  it("규칙으로 정해지면 Jev를 부르지 않는다", async () => {
    askJev.mockReset();
    expect(await classifyConsultField({ content: "어지럼증 평가", diagnosis: null })).toEqual({ field: "ear", reason: "어지럼" });
    expect(askJev).not.toHaveBeenCalled();
  });
  it("Jev 실패(null)면 판단 못 함", async () => {
    askJev.mockReset().mockResolvedValue(null);
    expect((await classifyConsultField({ content: "평가 부탁드립니다", diagnosis: "R69" })).field).toBe("unknown");
  });
  it("Jev가 확실하지 않으면(70% 미만) 판단 못 함, 확실하면 그 분야", async () => {
    askJev.mockReset().mockResolvedValueOnce({ field: { choice: "ear", confidence: 0.5 } });
    expect((await classifyConsultField({ content: "평가 부탁", diagnosis: null })).field).toBe("unknown");
    askJev.mockResolvedValueOnce({ field: { choice: "nose", confidence: 0.9 } });
    expect(await classifyConsultField({ content: "평가 부탁", diagnosis: null })).toEqual({ field: "nose", reason: "AI 판단(90%)" });
  });
  it("긴 숫자(등록번호 등)는 Jev로 보내지 않는다", async () => {
    askJev.mockReset().mockResolvedValue(null);
    await classifyConsultField({ content: "환자 12345678 평가 부탁", diagnosis: null });
    expect(JSON.stringify(askJev.mock.calls[0][0])).not.toMatch(/12345678/);
  });
});
