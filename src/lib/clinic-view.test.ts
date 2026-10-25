import { describe, expect, it } from "vitest";
import { inferStage, parseRoadmap, parseSoap } from "./clinic-view";

describe("진료 화면 — SOAP·로드맵 칸 나누기", () => {
  it("SOAP: 칸 머리별로, 머리 없는 줄은 앞 칸에", () => {
    const s = parseSoap("핵심: 술후 1주 확인\nS: 코막힘 호전\n출혈 없음\nO: 점막 부종\nA: s/p septoplasty\nP: 세척 지속");
    expect(s.core).toBe("술후 1주 확인");
    expect(s.S).toBe("코막힘 호전\n출혈 없음");
    expect(s.O).toBe("점막 부종");
    expect(s.P).toBe("세척 지속");
    expect(parseSoap(null).S).toBe("");
  });

  it("로드맵: 요약·경과(줄마다)·현재·할 일·확인", () => {
    const r = parseRoadmap("요약: CRSwNP, 10/16 ESS\n경과: 8/14 초진\n9/11 CT\n현재: 술후\n할 일: □세척 □내시경\n확인: 1개월 뒤");
    expect(r.summary).toBe("CRSwNP, 10/16 ESS");
    expect(r.course).toEqual(["8/14 초진", "9/11 CT"]);
    expect(r.now).toBe("술후");
    expect(r.todo).toBe("□세척 □내시경");
    expect(r.check).toBe("1개월 뒤");
  });
});

describe("진료 화면 — 지금 단계 판정", () => {
  const pp = (stageId: string, confirmed = false) => ({ pathwayId: "septo", stageId, confirmed, proposedReason: null });

  it("수술 기록이 있으면 지난 날수로 술후 단계", () => {
    const s = [{ date: "2026-10-14", name: "Septoplasty", done: true }];
    expect(inferStage(pp("decide"), s, "2026-10-21")).toMatchObject({ stageId: "po1", source: "surgery", reason: "수술 10/14 Septoplasty · 7일째" });
    expect(inferStage(pp("po1", true), s, "2026-11-04")?.stageId).toBe("po2");
    expect(inferStage(pp("po2"), s, "2027-01-20")?.stageId).toBe("po3");
  });

  it("앞으로 잡힌 수술 → 수술 단계, 이미 술후면 그대로", () => {
    const s = [{ date: "2026-11-03", name: "Septoplasty", done: false }];
    expect(inferStage(pp("decide"), s, "2026-10-27")).toMatchObject({ stageId: "surgery", source: "plan" });
  });

  it("수술 뒤 단계로 의사가 옮긴 것(종결)은 수술 날짜로 되돌리지 않음", () => {
    const s = [{ date: "2026-01-14", name: "Septoplasty", done: true }];
    expect(inferStage(pp("end", true), s, "2026-10-27")).toMatchObject({ stageId: "end", source: "doctor" });
  });

  it("경로가 둘이면 수술 이름이 맞는 경로에만", () => {
    const s = [{ date: "2026-10-14", name: "ESS", done: true }];
    expect(inferStage(pp("med"), s, "2026-10-21", 2)).toMatchObject({ stageId: "med", source: "ai" });
    expect(inferStage({ pathwayId: "crs_snp", stageId: "decide", confirmed: false, proposedReason: null }, s, "2026-10-21", 2)?.stageId).toBe("po_early");
  });

  it("수술 사실이 없으면 의사 확정 → AI 제안 순", () => {
    expect(inferStage(pp("med", true), [], "2026-10-27")).toMatchObject({ stageId: "med", source: "doctor" });
    expect(inferStage({ ...pp("med"), proposedReason: "약 4주째" }, [], "2026-10-27")).toMatchObject({ source: "ai", reason: "AI: 약 4주째" });
    expect(inferStage({ ...pp("med"), pathwayId: "nope" }, [], "2026-10-27")).toBeNull();
  });
});
