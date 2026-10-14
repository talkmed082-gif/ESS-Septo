// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { OutpatientCalendar, shiftMonth } from "./outpatient-calendar";

afterEach(cleanup);

describe("OutpatientCalendar", () => {
  it("2026년 10월은 목요일 시작, 명단 있는 날만 인원 수와 링크", () => {
    const { container } = render(
      <OutpatientCalendar month="2026-10" counts={{ "2026-10-20": 9, "2026-10-23": 2 }} selected="2026-10-20" today="2026-10-14" />,
    );
    const cells = Array.from(container.querySelectorAll(".grid > *")).slice(7); // 요일 머리 7칸 제외
    expect(cells.slice(0, 4).every((c) => c.textContent === "")).toBe(true); // 일~수 빈칸
    expect(cells[4].textContent).toBe("1");
    const links = Array.from(container.querySelectorAll("a[href^='/hospital?date=']"));
    expect(links.map((a) => [a.getAttribute("href"), a.textContent])).toEqual([
      ["/hospital?date=2026-10-20", "209명"],
      ["/hospital?date=2026-10-23", "232명"],
    ]);
  });

  it("이전·다음 달 이동(연도 넘김 포함)", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
