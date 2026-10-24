import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHILD_TEMPLATES,
  DEFAULT_TEMPLATES,
  EmrSetOrderBodySchema,
  FIRST_FIELDS,
  FOLLOW_FIELDS,
  TemplateInputSchema,
  normalizeDxCodes,
  parseSetOrderRefs,
} from "./outpatient-templates";

describe("외래 템플릿 형식", () => {
  it("성인 초안 13개(코 증상 9, 진단 의뢰 3, 검사 1 = 비인강경)는 모두 형식을 통과하고 이름이 겹치지 않는다", () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(13);
    expect(DEFAULT_TEMPLATES.filter((t) => t.kind === "symptom")).toHaveLength(9);
    expect(new Set(DEFAULT_TEMPLATES.map((t) => t.title)).size).toBe(13);
    // 코 전문(사용자 2026-10-24) — 귀 템플릿 없음
    expect([...DEFAULT_TEMPLATES, ...DEFAULT_CHILD_TEMPLATES].some((t) => /귀|이명|난청|중이염|어지럼/.test(t.title))).toBe(false);
    // 프로그램의 [비인강경] 버튼이 이 이름으로 찾는다
    expect(DEFAULT_TEMPLATES.find((t) => t.title === "비인강경")).toMatchObject({ kind: "exam", firstPe: "<비강 소견>", followObjective: "<비강 소견>" });
    for (const t of DEFAULT_TEMPLATES) {
      expect(TemplateInputSchema.safeParse({ ...t, setOrders: [] }).success).toBe(true);
    }
  });

  it("성인은 증상 9개만 번호 1~9(진단 의뢰·비인강경은 번호 없음), 소아 9개는 1~9이고 모두 형식 통과", () => {
    expect(DEFAULT_TEMPLATES.filter((t) => t.kind === "symptom").map((t) => t.shortcut)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(DEFAULT_TEMPLATES.filter((t) => t.kind !== "symptom").every((t) => t.shortcut === null)).toBe(true);
    expect(DEFAULT_CHILD_TEMPLATES.map((t) => [t.audience, t.shortcut])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ["child", n]));
    for (const t of DEFAULT_CHILD_TEMPLATES) expect(TemplateInputSchema.safeParse({ ...t, setOrders: [] }).success).toBe(true);
    // 재진은 S·P가 비면 오더를 못 낸다 → 비인강경은 재진 S·P, 초진 Plan을 갖는다
    expect(DEFAULT_TEMPLATES.find((t) => t.title === "비인강경")).toMatchObject({ followSubjective: "f/u", followPlan: "비인강경검사", firstPlan: "비인강경검사" });
  });

  it("단축 번호는 비워도 되고(빈칸 → null), 1~9 밖은 거절", () => {
    const base = { ...DEFAULT_TEMPLATES[0], setOrders: [] };
    expect(TemplateInputSchema.parse({ ...base, shortcut: "" }).shortcut).toBeNull();
    expect(TemplateInputSchema.parse({ ...base, shortcut: "3" }).shortcut).toBe(3);
    expect(TemplateInputSchema.safeParse({ ...base, shortcut: "10" }).success).toBe(false);
  });

  it("모든 칸이 빠짐없이 있어야 한다(칸이 빠지면 화면에서 그 칸이 지워진다)", () => {
    const base = { ...DEFAULT_TEMPLATES[0], setOrders: [] };
    for (const [k] of [...FIRST_FIELDS, ...FOLLOW_FIELDS]) {
      const { [k]: _drop, ...rest } = base;
      expect(TemplateInputSchema.safeParse(rest).success).toBe(false);
    }
  });

  it("저장된 약속처방 연결에서 형식이 깨진 항목은 버린다", () => {
    expect(
      parseSetOrderRefs([
        { ownerEmpNo: "2026539", key: "2026539^44", name: "Allergic Rhinitis" },
        { key: "x" },
        "bad",
      ]),
    ).toEqual([{ ownerEmpNo: "2026539", key: "2026539^44", name: "Allergic Rhinitis" }]);
    expect(parseSetOrderRefs(null)).toEqual([]);
  });

  it("약속처방 목록은 사번이 숫자여야 하고 처방 줄은 선택", () => {
    const item = { key: "2026539^44", path: "개인SET › 비과", name: "Allergic Rhinitis", level: 2 };
    expect(EmrSetOrderBodySchema.safeParse({ ownerEmpNo: "2026539", items: [item] }).success).toBe(true);
    expect(EmrSetOrderBodySchema.safeParse({ ownerEmpNo: "abc", items: [item] }).success).toBe(false);
    const withLines = { ...item, lines: [{ code: "X1", name: "약", dose: "1" }] };
    expect(EmrSetOrderBodySchema.parse({ ownerEmpNo: "2026539", items: [withLines] }).ownerName).toBe("");
  });
});

describe("진단 코드 정리", () => {
  it("점·공백·소문자 정리, 잘못된 코드·중복은 버림", () => {
    expect(normalizeDxCodes("J34.2, j343  J32.9;J34.2 / xx 123")).toBe("J342,J343,J329");
    expect(normalizeDxCodes("")).toBe("");
  });
  it("폼 입력도 같은 규칙", () => {
    const { dxCodes: _d, ...base } = { ...DEFAULT_TEMPLATES[0], setOrders: [] };
    expect(TemplateInputSchema.parse({ ...base, dxCodes: "r43.0 J33.9" }).dxCodes).toBe("R430,J339");
    expect(TemplateInputSchema.parse(base).dxCodes).toBe("");
  });
});
