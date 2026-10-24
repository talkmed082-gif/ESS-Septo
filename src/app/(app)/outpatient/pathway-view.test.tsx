import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("@/app/actions/pathway", () => ({ setStage: vi.fn(), removePathway: vi.fn() }));
const { PathwayView } = await import("./pathway-view");

describe("진료 경로 화면", () => {
  it("외래 버튼, 지난 단계 ✓·지금 ●, 지금 단계 할 일·갈림길, AI 제안을 보여 준다", () => {
    const html = renderToString(
      <PathwayView
        chartNo="12345678"
        visits={[
          { visitDate: "2026-08-14", summary: "초진, CT", pathwayId: "crs_t2", stageId: "eval" },
          { visitDate: "2026-09-30", summary: "약물 4주", pathwayId: "crs_t2", stageId: "mmt" },
        ]}
        pathways={[
          {
            pathwayId: "crs_t2",
            stageId: "reassess",
            confirmed: true,
            proposedStageId: "decide",
            proposedReason: "용종 지속",
            startedAt: "2026-08-14",
            history: [
              { stageId: "eval", date: "2026-08-14", by: "ai" },
              { stageId: "mmt", date: "2026-08-14", by: "doctor" },
              { stageId: "reassess", date: "2026-09-30", by: "doctor" },
            ],
          },
        ]}
      />,
    );
    const text = html.replace(/<[^>]+>/g, "").replace(/&gt;/g, ">");
    expect(text).toContain("8/14 초진");
    expect(text).toContain("9/30");
    expect(text).toContain("✓ 최대 약물치료");
    expect(text).toContain("● 재평가");
    expect(text).toContain("지금: 재평가");
    expect(text).toContain("◆ 조절?");
    expect(text).toContain("조절 안 됨");
    expect(text).toContain("AI 제안: 수술 결정 — 용종 지속");
    expect(text).toContain("확정");
    expect(text).not.toContain("이 단계 확정");
  });

  it("경로가 없으면 정하기 선택만", () => {
    const text = renderToString(<PathwayView chartNo="12345678" visits={[]} pathways={[]} />).replace(/<[^>]+>/g, "");
    expect(text).toContain("진료 경로 정하기…");
  });
});
