// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { TapButton } from "./tap-button";

afterEach(cleanup);

function setup(className = "") {
  const onTap = vi.fn();
  const { container } = render(
    <TapButton onTap={onTap} className={className}>
      라벨
    </TapButton>,
  );
  return { onTap, button: container.querySelector("button") as HTMLButtonElement };
}

function ptr(el: HTMLElement, type: string, x: number, y: number) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
}

describe("TapButton", () => {
  it("탭(누르고 뗌)으로 바로 실행되고 뒤따르는 click은 중복 실행하지 않는다", () => {
    const { onTap, button } = setup();
    ptr(button, "pointerdown", 5, 5);
    ptr(button, "pointerup", 6, 5);
    fireEvent.click(button, { detail: 1 });
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("크게 끌었거나 취소되면 실행하지 않는다", () => {
    const { onTap, button } = setup();
    ptr(button, "pointerdown", 5, 5);
    ptr(button, "pointerup", 5, 90);
    ptr(button, "pointerdown", 5, 5);
    ptr(button, "pointercancel", 5, 5);
    ptr(button, "pointerup", 5, 5);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("키보드 click(detail 0)은 그대로 실행한다", () => {
    const { onTap, button } = setup();
    fireEvent.click(button);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("전달한 className과 자식을 그대로 쓰고 누를 때 줄어드는 효과를 더하지 않는다", () => {
    const { button } = setup("rounded px-2");
    expect(button.textContent).toBe("라벨");
    expect(button.className).toContain("rounded px-2");
    expect(button.className).toContain("touch-manipulation");
    expect(button.className).not.toContain("scale-");
  });
});
