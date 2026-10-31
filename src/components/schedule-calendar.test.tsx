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
              ["2026-11-03", [{ doctor: "박지환", outpatient: 3, outpatientAm: null, outpatientPm: null, surgeries: [{ ...op, room: "3" }], cancelled: [{ ...op, name: "다*라", room: "88" }], off: null }]],
            ]),
          }}
        />,
      ),
    );
    expect(html).toContain("수술 1건 · 취소 1");
    expect(html).toContain("가*나 40/M 00000001 · ESS 3번방");
    expect(html).toContain("다*라 40/M 00000001 · ESS 88번방 취소");
  });

  it("오늘 칸에 \"오늘\", 교수님 오전/오후 수술·외래", () => {
    const html = text(
      renderToString(
        <ScheduleCalendar
          dates={["2026-11-03"]}
          today="2026-11-03"
          dayHref={(d) => d}
          data={{
            lists: new Map(),
            plans: new Map(),
            profs: new Map([
              ["2026-11-03", [{ doctor: "박지환", outpatient: 11, outpatientAm: 0, outpatientPm: 11, surgeries: [{ ...op, half: "오전" as const }], cancelled: [], off: null }]],
            ]),
          }}
        />,
      ),
    );
    expect(html).toContain("3 오늘");
    expect(html).toContain("박 오전 수술 1 박 오후 외래 11");
  });
});

describe("내 당직일", () => {
  it("칸에 \"당직\"과 같이 서는 사람, 날짜를 누르면 각자 일직·숙직", () => {
    const html = text(
      renderToString(
        <ScheduleCalendar
          dates={["2026-10-30", "2026-10-31"]}
          today="2026-10-31"
          selected="2026-10-31"
          dayHref={(d) => d}
          data={{
            lists: new Map(),
            plans: new Map(),
            profs: new Map(),
            duty: new Map([["2026-10-31", { mine: ["일직", "숙직"], mates: [{ name: "김석현", kinds: ["일직", "숙직"] }, { name: "최재혁", kinds: ["일직"] }] }]]),
          }}
        />,
      ),
    );
    expect(html).toContain("31 오늘 내 당직 전공의 당직: 김석현, 최재혁");
    expect(html).toContain("내 당직 · 일직·숙직 김석현 일직·숙직 최재혁 일직");
  });

  it("교수님이 같이 서면 교수 당직 줄이 따로", () => {
    const html = text(
      renderToString(
        <ScheduleCalendar
          dates={["2026-10-03"]}
          today="2026-10-31"
          dayHref={(d) => d}
          data={{ lists: new Map(), plans: new Map(), profs: new Map(), duty: new Map([["2026-10-03", { mine: ["숙직"], mates: [{ name: "박지환", kinds: ["숙직"] }, { name: "김수경", kinds: ["숙직"] }] }]]) }}
        />,
      ),
    );
    expect(html).toContain("3 내 당직 교수 당직: 박지환 전공의 당직: 김수경");
  });
});
