// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { MatrixCellButton } from "./matrix-cell-button";

afterEach(cleanup);

function setup() {
  const onToggle = vi.fn();
  const { container } = render(<MatrixCellButton checked={false} onToggle={onToggle} />);
  return { onToggle, button: container.querySelector("button") as HTMLButtonElement };
}

function ptr(el: HTMLElement, type: string, x: number, y: number) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
}

describe("MatrixCellButton", () => {
  it("탭(누르고 뗌)만으로 바로 토글되고, 뒤따르는 click은 중복 반영하지 않는다", () => {
    const { onToggle, button } = setup();
    ptr(button, "pointerdown", 10, 10);
    ptr(button, "pointerup", 11, 10);
    expect(onToggle).toHaveBeenCalledTimes(1);
    fireEvent.click(button, { detail: 1 }); // 브라우저가 이어서 보내는 click
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("손가락이 조금 움직여도(16px 이내) 탭으로 인정한다", () => {
    const { onToggle, button } = setup();
    ptr(button, "pointerdown", 10, 10);
    ptr(button, "pointerup", 22, 14);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("크게 끌었으면(스크롤/드래그) 토글하지 않는다", () => {
    const { onToggle, button } = setup();
    ptr(button, "pointerdown", 10, 10);
    ptr(button, "pointerup", 10, 80);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("브라우저가 탭을 취소(pointercancel)하면 토글하지 않는다", () => {
    const { onToggle, button } = setup();
    ptr(button, "pointerdown", 10, 10);
    ptr(button, "pointercancel", 10, 10);
    ptr(button, "pointerup", 10, 10);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("키보드(Enter/Space) 등 포인터 없는 click은 그대로 토글한다", () => {
    const { onToggle, button } = setup();
    fireEvent.click(button); // detail 0
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("같은 버튼을 빠르게 연달아 탭해도 매번 토글된다", () => {
    const { onToggle, button } = setup();
    for (let i = 0; i < 4; i++) {
      ptr(button, "pointerdown", 10, 10);
      ptr(button, "pointerup", 10, 10);
      fireEvent.click(button, { detail: 1 });
    }
    expect(onToggle).toHaveBeenCalledTimes(4);
  });

  it("누르는 동안 버튼이 작아지는 효과(scale)를 쓰지 않는다", () => {
    const { button } = setup();
    expect(button.className).not.toContain("scale-");
  });
});
