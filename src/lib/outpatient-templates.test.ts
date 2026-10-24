import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATES,
  EmrSetOrderBodySchema,
  FIRST_FIELDS,
  FOLLOW_FIELDS,
  TemplateInputSchema,
  parseSetOrderRefs,
} from "./outpatient-templates";

describe("외래 템플릿 형식", () => {
  it("기본 초안 9개(증상 7, 진단 2)는 모두 형식을 통과하고 이름이 겹치지 않는다", () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(9);
    expect(DEFAULT_TEMPLATES.filter((t) => t.kind === "symptom")).toHaveLength(7);
    expect(new Set(DEFAULT_TEMPLATES.map((t) => t.title)).size).toBe(9);
    for (const t of DEFAULT_TEMPLATES) {
      expect(TemplateInputSchema.safeParse({ ...t, setOrders: [] }).success).toBe(true);
    }
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
