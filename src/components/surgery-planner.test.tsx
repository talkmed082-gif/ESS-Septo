// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

vi.mock("@/app/actions/patient-plan", () => ({ createPatientWithPlan: vi.fn() }));

import { SurgeryPlanner } from "./surgery-planner";
import { essFullFields } from "@/lib/op-note-defs";

const types = [{ id: "1", code: "ESS", name: "ESS", fields: essFullFields }];

function sinusitisState(container: HTMLElement): string {
  const table = Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("부비동염"));
  return Array.from(table?.querySelectorAll("button") ?? [])
    .map((b) => (b.className.includes("emerald") ? "1" : "0"))
    .join("");
}

function sinusitisButtons(container: HTMLElement): HTMLButtonElement[] {
  const table = Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("부비동염"));
  return Array.from(table?.querySelectorAll("button") ?? []) as HTMLButtonElement[];
}

afterEach(cleanup);

// 버튼 순서: Frontal(0,1) Ant(2,3) Post(4,5) Max(6,7) Sphenoid(8,9) — 각 행 우측/좌측
describe("부비동염 셀 연속 클릭", () => {
  it("화면이 다시 그려지기 전에 연달아 눌러도 모든 클릭이 반영된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    act(() => {
      sinusitisButtons(container)[4].click(); // Post. Ethmoid 우측
      sinusitisButtons(container)[6].click(); // Maxillary 우측
    });
    expect(sinusitisState(container)).toBe("0000101000");
  });

  it("같은 셀을 연달아 두 번 누르면 원래대로 돌아온다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    act(() => {
      sinusitisButtons(container)[4].click();
      sinusitisButtons(container)[4].click();
    });
    expect(sinusitisState(container)).toBe("0000000000");
  });

  it("클릭이 하나씩 들어올 때도 그대로 동작한다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[4]);
    fireEvent.click(sinusitisButtons(container)[6]);
    expect(sinusitisState(container)).toBe("0000101000");
  });

  it("셀을 눌러도 표의 버튼이 새 요소로 교체되지 않는다 (교체되면 연타한 탭이 사라진다)", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    const before = sinusitisButtons(container);
    fireEvent.click(before[4]);
    fireEvent.click(before[6]);
    // 눌렀던 바로 그 버튼들이 아직 화면에 그대로 있어야 한다
    expect(before[4].isConnected).toBe(true);
    expect(before[6].isConnected).toBe(true);
    expect(sinusitisButtons(container)[4]).toBe(before[4]);
    expect(sinusitisState(container)).toBe("0000101000");
  });

  it("교체 없이 바뀐 값이 Op Plan 표와 저장될 폼 값에도 반영된다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[4]); // Post. Ethmoid 우측
    const form = container.querySelector("form") as HTMLFormElement;
    const hidden = (name: string) => form.elements.namedItem(`field_${name}`) as HTMLInputElement;
    expect(hidden("n_sinusitis_post_ethmoid_right").checked).toBe(true);
    expect(hidden("f_right_post_eth").checked).toBe(true);
    const fessTable = Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("FESS 시행"));
    expect(fessTable?.textContent).toContain("Post. ethmoidectomy");
    expect(container.textContent).toContain("Post. Ethmoid sinusitis: 우측");
    fireEvent.click(sinusitisButtons(container)[4]); // 다시 눌러 해제
    expect(hidden("n_sinusitis_post_ethmoid_right").checked).toBe(false);
    expect(hidden("f_right_post_eth").checked).toBe(false);
  });

  it("수술 후 화면의 모식도도 소견에서 켠 부위를 그대로 보여준다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    fireEvent.click(sinusitisButtons(container)[4]); // Post. Ethmoid 우측
    const diagramPost = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.trim() === "Post. Ethmoid");
    // 모식도 버튼은 우측 열이 먼저
    expect(diagramPost[0].className).toContain("emerald");
    expect(diagramPost[1].className).not.toContain("emerald");
  });

  it("Op Plan 표의 셀을 눌러도 교체 없이 소견 폼 값이 바뀐다", () => {
    const { container } = render(<SurgeryPlanner surgeryTypes={types} loggedIn />);
    const fessTable = () => Array.from(container.querySelectorAll("table")).find((t) => t.textContent?.includes("FESS 시행")) as HTMLTableElement;
    const cell = Array.from(fessTable().querySelectorAll("tbody tr"))[2].querySelectorAll("button")[0] as HTMLButtonElement; // Post. ethmoidectomy 우측
    fireEvent.click(cell);
    expect(cell.isConnected).toBe(true);
    const form = container.querySelector("form") as HTMLFormElement;
    expect((form.elements.namedItem("field_f_right_post_eth") as HTMLInputElement).checked).toBe(true);
  });
});
