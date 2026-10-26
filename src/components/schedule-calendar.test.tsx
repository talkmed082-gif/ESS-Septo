import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { PlanList, ScheduleCalendar } = await import("./schedule-calendar");

const text = (html: string) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const op = { name: "가*나", age: "40", sex: "M", chartNo: "00000001", op: "ESS" };

describe("수술방 번호·취소 표시", () => {
  it("수술 계획에 방 번호와 취소 표시", () => {
    const html = text(
      renderToString(
        <PlanList
          showDate={false}
          plans={[
            { id: "a", date: "2026-11-03", name: "홍길동", procedure: "ESS", done: false, room: "23번방", cancelled: false },
            { id: "b", date: "2026-11-03", name: "김철수", procedure: "Septoplasty", done: false, room: "66번방", cancelled: true },
          ]}
        />,
      ),
    );
    expect(html).toContain("홍길동 ESS 23번방");
    expect(html).toContain("김철수 Septoplasty 66번방 취소");
    expect(html.match(/취소/g)).toHaveLength(1);
  });

  it("교수님 수술: 취소는 건수에서 빼고 따로 보인다", () => {
    const html = text(
      renderToString(
        <ScheduleCalendar
          dates={["2026-11-03"]}
          today="2026-11-01"
          selected="2026-11-03"
          dayHref={(d) => d}
          data={{
            lists: new Map(),
            plans: new Map(),
            profs: new Map([
              ["2026-11-03", [{ doctor: "박지환", outpatient: 3, surgeries: [{ ...op, room: "3" }], cancelled: [{ ...op, name: "다*라", room: "88" }], off: null }]],
            ]),
          }}
        />,
      ),
    );
    expect(html).toContain("수술 1건 · 취소 1");
    expect(html).toContain("가*나 40/M 00000001 · ESS 3번방");
    expect(html).toContain("다*라 40/M 00000001 · ESS 88번방 취소");
  });
});
