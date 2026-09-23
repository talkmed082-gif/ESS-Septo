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
});
