// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TemplateForm, type SetOrderOption } from "./template-form";

afterEach(cleanup);

const options: SetOrderOption[] = [
  { ownerEmpNo: "2026539", ownerName: "정일구", key: "2026539^44", name: "Allergic Rhinitis", path: "개인SET › 비과" },
  { ownerEmpNo: "2026539", ownerName: "정일구", key: "2026539^40", name: "비과 외래 초진", path: "개인SET › 비과" },
  { ownerEmpNo: "1999001", ownerName: "김전공", key: "1999001^3", name: "AR 약", path: "개인SET" },
];
const noop = async () => {};
const hidden = (c: HTMLElement) => JSON.parse((c.querySelector("input[name=setOrders]") as HTMLInputElement).value);

describe("TemplateForm 약속처방 고르기", () => {
  it("검색해서 누르면 연결되고, 빼기로 뺀다(hidden 칸에 그대로 담긴다)", () => {
    const { container } = render(<TemplateForm template={null} options={options} myEmpNo={null} action={noop} />);
    fireEvent.change(screen.getByLabelText("약속처방 검색"), { target: { value: "비과 초진" } });
    const hits = screen.getAllByRole("button").filter((b) => b.textContent?.includes("비과 외래 초진"));
    expect(hits).toHaveLength(1);
    fireEvent.click(hits[0]);
    expect(hidden(container)).toEqual([{ ownerEmpNo: "2026539", key: "2026539^40", name: "비과 외래 초진" }]);

    // 이미 연결한 건 검색에 다시 안 나온다
    fireEvent.change(screen.getByLabelText("약속처방 검색"), { target: { value: "비과" } });
    expect(screen.getAllByRole("button").filter((b) => b.textContent?.includes("비과 외래 초진") && b.textContent?.includes("›"))).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "빼기" }));
    expect(hidden(container)).toEqual([]);
  });

  it("다른 사람 세트는 이름 옆에 그 사람 이름을 붙이고, 목록에서 사라진 연결은 표시한다", () => {
    render(
      <TemplateForm
        template={{
          title: "재채기/알레르기",
          kind: "symptom",
          sortOrder: 50,
          setOrders: [
            { ownerEmpNo: "1999001", key: "1999001^3", name: "AR 약" },
            { ownerEmpNo: "2026539", key: "2026539^99", name: "지운 세트" },
          ],
        }}
        options={options}
        myEmpNo="2026539"
        action={noop}
      />,
    );
    expect(screen.getByText("AR 약 (김전공)")).toBeTruthy();
    expect(screen.getByText("지운 세트 — 목록에 없음")).toBeTruthy();
  });
});
