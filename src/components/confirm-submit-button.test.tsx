// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ConfirmSubmitButton } from "./confirm-submit-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function clickSubmit(confirmed: boolean): boolean {
  vi.spyOn(window, "confirm").mockReturnValue(confirmed);
  const { getByRole } = render(
    <form>
      <ConfirmSubmitButton message="삭제할까요?">계획 삭제</ConfirmSubmitButton>
    </form>,
  );
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  getByRole("button").dispatchEvent(ev);
  return ev.defaultPrevented;
}

describe("ConfirmSubmitButton", () => {
  it("확인을 취소하면 제출하지 않는다", () => {
    expect(clickSubmit(false)).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith("삭제할까요?");
  });

  it("확인하면 그대로 제출한다", () => {
    expect(clickSubmit(true)).toBe(false);
  });
});
