import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { postOpBxTodo } from "@/lib/clinic-view";

vi.mock("@/app/actions/pathway", () => ({ setStage: vi.fn(), removePathway: vi.fn() }));
vi.mock("@/app/actions/clinic", () => ({ sendToClinic: vi.fn(), cancelClinicJob: vi.fn(), saveClinicDefaults: vi.fn() }));
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
    const follow = text(renderToString(<OrderPanel chartNo="1" name="홍○○" visit="재진" visitDate="2026-10-27" canSend templates={[]} job={null} />));
    expect(follow).toContain("이전 이비인후과 외래기록으로 S·O·A·P");
    expect(follow).toContain("노트북으로 보내기");
    expect(follow).toContain("기록지 열면 바로");
    expect(follow).toContain("이 설정 저장");
    // 비인강경은 기본 끔 — 켜진 체크 상자는 기록지·진단 확인 2개뿐
    const html = renderToString(<OrderPanel chartNo="1" name="홍○○" visit="재진" visitDate="2026-10-27" canSend templates={[]} job={null} />);
    expect(html.match(/checked=""/g)?.length).toBe(2);
    const first = text(
      renderToString(
        <OrderPanel
          chartNo="1"
          name="홍○○"
          visit="초진"
          visitDate="2026-10-27"
          canSend={false}
          templates={[{ id: "t1", title: "코막힘", audience: "adult" }]}
          job={{ id: "j", status: "failed", result: "진단: 주진단 경증 — 멈춤", where: "clinic", practice: false, updatedAt: "" }}
        />,
      ),
    );
    expect(first).toContain("초진·재초는 템플릿을 고르세요");
    expect(first).toContain("지난 외래는 보낼 수 없습니다");
    expect(first).toContain("진료실 PC · 멈춤 — 확인 필요");
    expect(first).toContain("주진단 경증");
  });
});

describe("명단에서 바로 보내기 — 설정 따로, 보내기 따로", () => {
  const defaults = { where: "laptop" as const, note: true, dx: true, scope: false };
  it("명단 줄마다 체크(처음엔 꺼짐), 고르기 전엔 보내기 버튼 없음, 보낸 상태 점", async () => {
    vi.doMock("@/app/actions/clinic", () => ({ sendToClinic: vi.fn(), cancelClinicJob: vi.fn(), sendBatchToLaptop: vi.fn(), saveClinicDefaults: vi.fn() }));
    const { ClinicList } = await import("./clinic-list");
    const html = renderToString(
      <ClinicList
        date="2026-10-27"
        chart="1"
        canSend
        defaults={defaults}
        templates={[{ id: "t1", title: "코막힘", audience: "adult" }]}
        rows={[
          { time: "09:00", name: "김○○", chartNo: "1", visit: "초진", diagnosis: "", job: null },
          { time: "09:10", name: "홍○○", chartNo: "2", visit: "재진", diagnosis: "deviated nasal septum", job: "done" },
        ]}
      />,
    );
    const t = text(html);
    expect(html.match(/type="checkbox"/g)?.length).toBe(2);
    expect(html).not.toContain('checked=""');
    expect(t).toContain("안 보낸 환자 모두");
    expect(t).not.toContain("노트북으로 보내기");
    expect(html).toContain('title="완료"');
  });
  it("지난 외래는 체크 없이 명단만", async () => {
    const { ClinicList } = await import("./clinic-list");
    const html = renderToString(<ClinicList date="2026-10-20" chart={undefined} canSend={false} defaults={defaults} templates={[]} rows={[{ time: "09:00", name: "김○○", chartNo: "1", visit: "재진", diagnosis: "", job: null }]} />);
    expect(html).not.toContain('type="checkbox"');
  });
  it("보내기 설정은 지금 값을 한 줄로, 비인강경 끄면 기록지 저장(서명 전)", async () => {
    const { SendSettings } = await import("./clinic-list");
    const t = text(renderToString(<SendSettings defaults={defaults} />));
    expect(t).toContain("기록지 · 진단 확인 · 기록지 저장(서명 전)");
    expect(t).toContain("바꾸기");
  });
});
describe("postOpBxTodo(수술 후 첫 외래)", () => {
  const op = (date: string, done = true) => ({ date, name: "ESS", done });
  it("수술 뒤 외래 요약이 없으면 Bx. 확인", () => {
    expect(postOpBxTodo([op("2026-10-16")], ["2026-09-01"], "2026-10-27")).toBe("Bx. 확인(수술 10/16)");
  });
  it("수술 뒤 외래가 이미 있으면 없음, 수술 안 했거나 오래되면 없음", () => {
    expect(postOpBxTodo([op("2026-10-16")], ["2026-10-20"], "2026-10-27")).toBeNull();
    expect(postOpBxTodo([op("2026-10-16", false)], [], "2026-10-27")).toBeNull();
    expect(postOpBxTodo([op("2026-05-01")], [], "2026-10-27")).toBeNull();
  });
});

describe("노트북 지금", () => {
  it("처리 중이면 환자·단계, 아니면 쉬는 중, 날짜 건수와 멈춤", async () => {
    const { LaptopNow } = await import("./laptop-now");
    const busy = text(
      renderToString(
        <LaptopNow
          view={{
            running: { time: "13:30", name: "홍*동", visit: "재진", visitDate: "2026-10-27", step: "환자 선택", updatedAt: new Date().toISOString() },
            counts: { pending: 3, waiting: 1, done: 2, failed: 1 },
            date: "2026-10-27",
          }}
        />,
      ),
    );
    expect(busy).toContain("13:30 홍*동 재진");
    expect(busy).toContain("환자 선택");
    expect(busy).toContain("대기 3 · 나중에 다시 1 · 완료 2");
    expect(busy).toContain("멈춤 1");
    const idle = text(renderToString(<LaptopNow view={{ running: null, counts: { pending: 0, waiting: 0, done: 0, failed: 0 }, date: "2026-10-27" }} />));
    expect(idle).toContain("쉬는 중");
  });
});