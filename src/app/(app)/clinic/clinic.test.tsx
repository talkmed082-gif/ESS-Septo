import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("@/app/actions/pathway", () => ({ setStage: vi.fn(), removePathway: vi.fn() }));
vi.mock("@/app/actions/clinic", () => ({ sendToClinic: vi.fn(), cancelClinicJob: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { PathwayFlow } = await import("./pathway-flow");
const { OrderPanel } = await import("./order-panel");

const text = (html: string) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&gt;/g, ">").replace(/\s+/g, " ");

describe("진료 화면", () => {
  it("로드맵 도형: 지난 ✓, 지금 단계, 판정이 다르면 판정 표시·근거·확정 버튼, 갈림길 마름모", () => {
    const html = renderToString(
      <PathwayFlow
        chartNo="12345678"
        visits={[{ visitDate: "2026-09-11", summary: "약물 시작", pathwayId: "septo", stageId: "med" }]}
        pathways={[
          {
            pathwayId: "septo",
            stageId: "decide",
            confirmed: true,
            proposedStageId: null,
            proposedReason: null,
            startedAt: "2026-09-11",
            history: [
              { stageId: "eval", date: "2026-09-11", by: "ai" },
              { stageId: "med", date: "2026-09-11", by: "doctor" },
              { stageId: "decide", date: "2026-10-01", by: "doctor" },
            ],
          },
        ]}
        calls={{ septo: { stageId: "po1", reason: "수술 10/14 Septoplasty · 7일째", source: "surgery" } }}
      />,
    );
    const t = text(html);
    expect(t).toContain("✓ 약물치료");
    expect(t).toContain("판정: 술후 1주");
    expect(t).toContain("근거(수술 기록) 수술 10/14 Septoplasty · 7일째");
    expect(t).toContain("이 단계로 확정");
    expect(t).toContain("지금: 수술 결정");
    expect(html).toContain("border-dashed"); // 판정 단계 상자
    expect(html).toContain("rotate-45"); // 갈림길 마름모
    expect(t).toContain("9/11 초진");
  });

  it("오더 패널: 재진은 이전 기록, 초진은 템플릿 안내, 보낸 일감 상태와 결과", () => {
    const follow = text(renderToString(<OrderPanel chartNo="1" name="홍○○" visit="재진" visitDate="2026-10-27" isToday templates={[]} job={null} />));
    expect(follow).toContain("이전 이비인후과 외래기록으로 S·O·A·P");
    expect(follow).toContain("노트북으로 보내기");
    expect(follow).toContain("기록지 열면 바로");
    const first = text(
      renderToString(
        <OrderPanel
          chartNo="1"
          name="홍○○"
          visit="초진"
          visitDate="2026-10-27"
          isToday={false}
          templates={[{ id: "t1", title: "코막힘", audience: "adult" }]}
          job={{ id: "j", status: "failed", result: "진단: 주진단 경증 — 멈춤", where: "clinic", practice: false, updatedAt: "" }}
        />,
      ),
    );
    expect(first).toContain("초진·재초는 템플릿을 고르세요");
    expect(first).toContain("오늘 외래만 보낼 수 있습니다");
    expect(first).toContain("진료실 PC · 멈춤 — 확인 필요");
    expect(first).toContain("주진단 경증");
  });
});
