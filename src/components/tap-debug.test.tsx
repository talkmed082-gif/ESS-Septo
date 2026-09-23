// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { TapDebug } from "./tap-debug";

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("TapDebug", () => {
  it("주소에 ?tapdebug 가 없으면 아무것도 그리지 않는다", () => {
    render(<TapDebug />);
    expect(document.querySelector("pre")).toBeNull();
  });

  it("?tapdebug=1 이면 로그 창을 띄우고, 이벤트를 기록하고, 언마운트하면 지운다", () => {
    window.history.pushState({}, "", "/?tapdebug=1");
    const { unmount } = render(<TapDebug />);
    const box = document.querySelector("pre") as HTMLPreElement;
    expect(box.textContent).toContain("tapdebug on");
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(box.textContent).toContain("click");
    unmount();
    expect(document.querySelector("pre")).toBeNull();
  });
});
