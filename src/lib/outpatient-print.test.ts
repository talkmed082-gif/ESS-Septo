import { describe, expect, it } from "vitest";
import { buildPrintRow, maskName, type PrintInput } from "./outpatient-print";

const base: PrintInput = {
  row: { time: "09:20", name: "홍길동", chartNo: "12345678", visit: "재진", diagnosis: "CRS c NP", sex: "M", age: "54" },
  roadmapText: "",
  done: [],
  pathways: [],
  visits: [],
  surgeries: [],
};
const build = (p: Partial<PrintInput>, date = "2026-10-27", mask = false) => buildPrintRow({ ...base, ...p }, date, { mask });

describe("외래 명단 인쇄 — 이름 가리기", () => {
  it("가운데 글자를 *로(두 글자면 뒤 글자)", () => {
    expect(maskName("홍길동")).toBe("홍*동");
    expect(maskName("남궁민수")).toBe("남**수");
    expect(maskName("김철")).toBe("김*");
    expect(maskName("이")).toBe("이");
    expect(maskName(" 홍길동 ")).toBe("홍*동");
  });
});

describe("외래 명단 인쇄 — 환자 한 칸", () => {
  it("데이터 없는 환자도 기본 줄은 나온다", () => {
    const r = build({});
    expect(r).toMatchObject({ time: "09:20", name: "홍길동", sexAge: "M/54", chartNo: "12345678", visit: "재진", diagnosis: "CRS c NP" });
    expect(r.today).toEqual([]);
    expect(r.todos).toEqual([]);
    expect(r.last).toBe("");
  });

  it("mask 옵션이면 이름을 가린다", () => {
    expect(build({}, "2026-10-27", true).name).toBe("홍*동");
  });

  it("로드맵 할 일은 아직 안 한 것만", () => {
    const r = build({ roadmapText: "요약: CRSwNP\n할 일: □CT f/u 오더 □스테로이드 감량 확인\n□세척 교육", done: ["스테로이드 감량 확인"] });
    expect(r.todos).toEqual(["CT f/u 오더", "세척 교육"]);
  });

  it("오늘 할 것: 수술 후 첫 외래면 Bx. 확인, 진료 경로 지금 단계 할 일", () => {
    const r = build({
      pathways: [{ pathwayId: "crs_snp", stageId: "decide", confirmed: false, proposedReason: null }],
      surgeries: [{ date: "2026-10-16", name: "ESS", done: true }],
    });
    expect(r.today[0]).toBe("Bx. 확인(수술 10/16)");
    // 수술 11일째 → 술후 초기 단계 할 일
    expect(r.today[1]).toMatch(/^술후/);
  });

  it("오늘 할 것: 다가오는 수술은 날짜와 이름", () => {
    const r = build({ surgeries: [{ date: "2026-11-03", name: "Septoturbinoplasty", done: false }] });
    expect(r.today).toContain("수술 예정 11/3 Septoturbinoplasty");
  });

  it("지난 진료 요약: 오늘 전 마지막 외래 요약 → 없으면 로드맵 현재 → 요약 → SOAP 핵심", () => {
    const visits = [
      { visitDate: "2026-09-01", summary: "초진, CT 오더" },
      { visitDate: "2026-10-20", summary: "패킹 제거, 출혈 없음" },
      { visitDate: "2026-10-27", summary: "오늘 것(무시)" },
    ];
    expect(build({ visits }).last).toBe("10/20 패킹 제거, 출혈 없음");
    expect(build({ roadmapText: "요약: CRSwNP\n현재: 약물치료 4주째" }).last).toBe("약물치료 4주째");
    expect(build({ roadmapText: "요약: CRSwNP, 10/16 ESS" }).last).toBe("CRSwNP, 10/16 ESS");
    expect(build({ row: { ...base.row, soap: "핵심: 술후 1주 확인\nS: 호전" } }).last).toBe("술후 1주 확인");
  });

  it("성별·나이가 없으면 빈칸", () => {
    expect(build({ row: { ...base.row, sex: undefined, age: undefined } }).sexAge).toBe("");
    expect(build({ row: { ...base.row, sex: "F", age: undefined } }).sexAge).toBe("F");
  });
});
