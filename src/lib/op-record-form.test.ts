import { describe, expect, it } from "vitest";
import { parseRecordFormData } from "@/lib/op-record-form";

describe("기록지 폼 검사", () => {
  it("화면에 없는 findings 칸이 빠져도 저장을 거절하지 않는다", () => {
    const fd = new FormData();
    fd.set("operationDate", "2026-10-06");
    fd.set("surgeonName", "의사");
    fd.set("procedureDetail", "본문");
    expect(parseRecordFormData(fd).success).toBe(true);
  });

  it("필수 항목(수술일·집도의)이 비면 거절한다", () => {
    expect(parseRecordFormData(new FormData()).success).toBe(false);
  });
});
