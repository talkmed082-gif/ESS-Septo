import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldValues } from "./field-types";
import { buildProcedureName, generateOpNote, type NameStyle } from "./op-note-generator";

const askJev = vi.fn();
vi.mock("@/lib/jev", () => ({
  askJev: (...args: unknown[]) => askJev(...args),
  noul: (instructions: unknown, criteria: unknown) => ({ type: "noul", instructions, criteria }),
}));

const { checkRecordConsistency } = await import("./record-consistency");

const STYLE: NameStyle = { sideNotation: "full", abbreviateRegions: false };
const RIGHT_ESS: FieldValues = { f_right_mma: true, f_right_ant_eth: true };

function autoText(values: FieldValues) {
  const note = generateOpNote("ESS", values, "record");
  return {
    procedureName: buildProcedureName("ESS", values, STYLE),
    procedureDetail: [note.findings, note.procedureDetail].filter(Boolean).join("\n\n"),
  };
}

function input(overrides: Partial<Parameters<typeof checkRecordConsistency>[0]> = {}) {
  const auto = autoText(RIGHT_ESS);
  return {
    surgeryTypeCode: "ESS",
    recordValues: RIGHT_ESS,
    nameStyle: STYLE,
    procedureName: auto.procedureName,
    procedureDetail: auto.procedureDetail.replaceAll("우측", "좌측"),
    ...overrides,
  };
}

const answer = (sideMismatch: number, missingProcedure = 0, extraProcedure = 0) => ({
  sideMismatch: { noul: sideMismatch },
  missingProcedure: { noul: missingProcedure },
  extraProcedure: { noul: extraProcedure },
});

beforeEach(() => askJev.mockReset());

describe("checkRecordConsistency", () => {
  it("Jev가 모순이라고 확신하면 해당 경고를 돌려준다", async () => {
    askJev.mockResolvedValue(answer(0.95));
    const warnings = await checkRecordConsistency(input());
    expect(warnings).toEqual(["좌우(Rt/Lt/양측) 표기가 체크한 항목과 다를 수 있어요."]);
  });

  it("확신이 기준(0.8)보다 낮으면 경고하지 않는다", async () => {
    askJev.mockResolvedValue(answer(0.6, 0.79, 0.1));
    expect(await checkRecordConsistency(input())).toEqual([]);
  });

  it("여러 항목이 걸리면 모두 돌려준다", async () => {
    askJev.mockResolvedValue(answer(0.9, 0.9, 0.9));
    expect(await checkRecordConsistency(input())).toHaveLength(3);
  });

  it("Jev 호출이 실패(null)하면 경고 없이 넘어간다 — 검사 없던 때와 같은 동작", async () => {
    askJev.mockResolvedValue(null);
    expect(await checkRecordConsistency(input())).toEqual([]);
  });

  it("자동 생성된 글을 그대로 저장하면 Jev를 부르지 않는다 (공백 차이는 무시)", async () => {
    const auto = autoText(RIGHT_ESS);
    const warnings = await checkRecordConsistency(
      input({ procedureName: auto.procedureName, procedureDetail: `  ${auto.procedureDetail}\n` }),
    );
    expect(warnings).toEqual([]);
    expect(askJev).not.toHaveBeenCalled();
  });

  it("자동 생성을 지원하지 않는 커스텀 수술이면 Jev를 부르지 않는다", async () => {
    expect(await checkRecordConsistency(input({ surgeryTypeCode: "CUSTOM" }))).toEqual([]);
    expect(askJev).not.toHaveBeenCalled();
  });

  it("기록지 본문이 비어 있으면 Jev를 부르지 않는다", async () => {
    expect(await checkRecordConsistency(input({ procedureDetail: "  " }))).toEqual([]);
    expect(askJev).not.toHaveBeenCalled();
  });

  it("Jev로는 기준 기록지와 저장할 기록지 글만 보낸다 (환자 정보 필드 없음)", async () => {
    askJev.mockResolvedValue(answer(0));
    await checkRecordConsistency(input());
    const state = askJev.mock.calls[0][0];
    expect(Object.keys(state).sort()).toEqual(["기준_기록지", "저장할_기록지"]);
    for (const part of Object.values(state) as Record<string, unknown>[]) {
      expect(Object.keys(part).sort()).toEqual(["본문", "설명", "수술명"]);
    }
  });
});
