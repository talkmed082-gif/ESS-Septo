// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { CcInput } from "./cc-input";

afterEach(cleanup);

function Harness() {
  const [v, setV] = useState("");
  return <CcInput value={v} onChange={setV} />;
}

const btn = (c: HTMLElement, label: string) =>
  Array.from(c.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") ?? b.textContent) === label) as HTMLButtonElement;
const input = (c: HTMLElement) => c.querySelector("input[name='chiefComplaint']") as HTMLInputElement;

describe("CcInput", () => {
  it("증상을 누르면 들어가고, 옆에 나온 방향을 고르면 그 증상에만 붙는다", () => {
    const { container } = render(<Harness />);
    fireEvent.click(btn(container, "코막힘"));
    expect(input(container).value).toBe("코막힘");
    fireEvent.click(btn(container, "코막힘 Both"));
    fireEvent.click(btn(container, "후비루"));
    fireEvent.click(btn(container, "Foul odor"));
    fireEvent.click(btn(container, "Foul odor Lt."));
    expect(input(container).value).toBe("코막힘 (Both), 후비루, Foul odor (Lt.)");
  });

  it("같은 방향을 다시 누르면 방향만 지우고, 증상을 다시 누르면 뺀다", () => {
    const { container } = render(<Harness />);
    fireEvent.click(btn(container, "코막힘"));
    fireEvent.click(btn(container, "코막힘 Rt."));
    fireEvent.click(btn(container, "코막힘 Rt."));
    expect(input(container).value).toBe("코막힘");
    fireEvent.click(btn(container, "코막힘"));
    expect(input(container).value).toBe("");
    expect(btn(container, "코막힘 Rt.")).toBeUndefined(); // 빠지면 방향 버튼도 사라짐
  });

  it("방향이 없는 증상(후비루)에는 방향 버튼이 나오지 않는다", () => {
    const { container } = render(<Harness />);
    fireEvent.click(btn(container, "후비루"));
    expect(btn(container, "후비루 Rt.")).toBeUndefined();
  });
});
