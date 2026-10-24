import { describe, expect, it } from "vitest";
import { PATHWAYS, applyProposal, parsePathwayLines, planOfStage, pushHistory, SetStageSchema, summaryLine } from "./pathways";

describe("경로 정의", () => {
  it("경로·단계 id는 겹치지 않고, 갈림길이 가리키는 단계는 같은 경로 안에 있다", () => {
    expect(new Set(PATHWAYS.map((p) => p.id)).size).toBe(PATHWAYS.length);
    for (const p of PATHWAYS) {
      const ids = p.stages.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of p.stages) for (const o of s.decide?.options ?? []) if (o.to) expect(ids, `${p.id}.${s.id} → ${o.to}`).toContain(o.to);
    }
  });
});

describe("AI 경로 줄 읽기", () => {
  it("경로·외래 줄을 떼어 내고 나머지 글은 로드맵으로 남긴다", () => {
    const r = parsePathwayLines(
      ["경과: 8/14 초진", "[경로] crs_t2 = mmt | 용종 Gr2, 스테로이드 시작", "[외래] 2026-08-14 | crs_t2:eval | 초진, CT 처방", "현재: 약물치료"].join("\n"),
    );
    expect(r.rest).toBe("경과: 8/14 초진\n현재: 약물치료");
    expect(r.pathways).toEqual([{ pathwayId: "crs_t2", stageId: "mmt", reason: "용종 Gr2, 스테로이드 시작" }]);
    expect(r.visits).toEqual([{ date: "2026-08-14", pathwayId: "crs_t2", stageId: "eval", summary: "초진, CT 처방" }]);
  });

  it("없는 경로·단계는 버리고, 경로는 2개까지·같은 경로는 한 번만", () => {
    const r = parsePathwayLines(
      ["[경로] nope = eval", "[경로] ar = nope", "[경로] ar = med", "[경로] ar = eval", "[경로] septo = med", "[경로] olf = eval", "[외래] 2026-09-01 | zz:yy | 요약만 남김"].join("\n"),
    );
    expect(r.pathways.map((p) => `${p.pathwayId}=${p.stageId}`)).toEqual(["ar=med", "septo=med"]);
    expect(r.visits).toEqual([{ date: "2026-09-01", pathwayId: null, stageId: null, summary: "요약만 남김" }]);
    expect(r.rest).toBe("");
  });
});

describe("AI 제안 반영", () => {
  const prop = { pathwayId: "crs_snp", stageId: "reassess", reason: "4주 경과" };
  it("처음이면 AI 단계로 시작(확정 아님)", () => {
    expect(applyProposal(null, prop, "2026-10-24")).toMatchObject({ stageId: "reassess", confirmed: false, history: [{ stageId: "reassess", by: "ai" }] });
  });
  it("의사가 확정한 경로는 단계를 바꾸지 않고 제안으로만 남긴다", () => {
    const cur = { stageId: "mmt", confirmed: true, history: [{ stageId: "mmt", date: "2026-10-01", by: "doctor" as const }] };
    expect(applyProposal(cur, prop, "2026-10-24")).toMatchObject({ stageId: "mmt", confirmed: true, proposedStageId: "reassess", history: cur.history });
    expect(applyProposal(cur, { ...prop, stageId: "mmt" }, "2026-10-24").proposedStageId).toBeNull();
  });
  it("확정 전이면 AI 단계로 바꾸고 이력을 쌓는다", () => {
    const cur = { stageId: "mmt", confirmed: false, history: [{ stageId: "mmt", date: "2026-10-01", by: "ai" as const }] };
    expect(applyProposal(cur, prop, "2026-10-24").history.map((h) => h.stageId)).toEqual(["mmt", "reassess"]);
  });
  it("같은 단계는 이력에 다시 쌓지 않는다", () => {
    expect(pushHistory([{ stageId: "a", date: "1", by: "ai" }], { stageId: "a", date: "2", by: "doctor" })).toHaveLength(1);
  });
});

describe("Plan·요약", () => {
  it("수술 단계는 수술, 약물 단계는 약물치료, 술후 추적은 경과관찰, 평가·결정은 Plan 안 바꿈", () => {
    expect(planOfStage("surgery")).toBe("surgery");
    expect(planOfStage("mmt")).toBe("medication");
    expect(planOfStage("surv_2y")).toBe("observation");
    expect(planOfStage("decide")).toBeNull();
    expect(planOfStage("eval")).toBeNull();
  });
  it("모든 경로의 단계 id는 Plan 표에 있거나 일부러 뺀 평가·결정 단계", () => {
    const none = new Set(["eval", "decide", "reassess", "workup", "biopsy", "malignant"]);
    for (const p of PATHWAYS) for (const s of p.stages) if (!none.has(s.id)) expect(planOfStage(s.id), `${p.id}.${s.id}`).not.toBeNull();
  });
  it("로드맵 글의 요약 줄", () => {
    expect(summaryLine("요약: CRSwNP, 10/16 ESS 후 술후 관리 중\n경과: …")).toBe("CRSwNP, 10/16 ESS 후 술후 관리 중");
    expect(summaryLine("경과: …")).toBeNull();
  });
});

describe("의사 단계 지정 형식", () => {
  it("있는 경로·단계만", () => {
    expect(SetStageSchema.safeParse({ chartNo: "12345678", pathwayId: "ip", stageId: "surv_2y" }).success).toBe(true);
    expect(SetStageSchema.safeParse({ chartNo: "12345678", pathwayId: "ip", stageId: "mmt" }).success).toBe(false);
    expect(SetStageSchema.safeParse({ chartNo: "12a", pathwayId: "ip", stageId: "eval" }).success).toBe(false);
  });
});
