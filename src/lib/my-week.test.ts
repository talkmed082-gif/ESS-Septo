import { describe, expect, it } from "vitest";
import { myDay, profSurgeryTags, scheduleDay, type DayFacts } from "./my-week";

const op = (op: string) => ({ name: "김○○", age: "50", sex: "M", chartNo: "1", op });
const facts = (p: Partial<DayFacts> = {}): DayFacts => ({ profs: [], myOpd: { count: 0, clinic: null }, myPlans: [], pause: null, ...p });

describe("내 주간 일정", () => {
  it("월: 오전 박지환 교수님 수술(순서대로), 오후 문수진 교수님 외래 인원", () => {
    const s = myDay("2026-10-26", facts({ profs: [{ doctor: "박지환", outpatient: 0, surgeries: [op("ESS"), op("Septoplasty")] }, { doctor: "문수진", outpatient: 12, surgeries: [] }] }));
    expect(s.map((x) => `${x.session} ${x.title}`)).toEqual(["오전 박지환 교수님 수술 어시스트", "오후 문수진 교수님 외래 어시스트"]);
    expect(s[0].lines[0]).toMatchObject({ type: "surgeries", items: [{ op: "ESS" }, { op: "Septoplasty" }] });
    expect(s[1].lines[0]).toMatchObject({ text: "외래 12명" });
  });

  it("화 오후 어린이병원 외래는 내 외래 명단, 목 오전은 그날 교수님 수술 전부", () => {
    const tue = myDay("2026-10-27", facts({ myOpd: { count: 13, clinic: "소아이비인후클리닉" } }));
    expect(tue[1]).toMatchObject({ title: "어린이병원 외래", lines: [{ type: "opd", text: "내 외래 13명 · 소아이비인후클리닉" }] });
    const thu = myDay("2026-10-29", facts({ profs: [{ doctor: "최성욱", outpatient: 5, surgeries: [op("TM")] }] }));
    expect(thu[0].title).toContain("참관");
    expect(thu[0].lines[0]).toMatchObject({ type: "surgeries", prof: "최성욱" });
  });

  it("금 오전은 그날 있는 것(내 외래·내 수술·문수진 교수님 외래), 없으면 없음", () => {
    const fri = myDay("2026-10-30", facts({ myPlans: [{ id: "p", name: "홍○○", procedure: "ESS" }], profs: [{ doctor: "문수진", outpatient: 8, surgeries: [] }] }));
    expect(fri[0].lines.map((l) => l.type)).toEqual(["myPlans", "text"]);
    expect(myDay("2026-10-30", facts())[0].lines[0]).toMatchObject({ muted: true });
  });

  it("쉬는 날이면 그것만, 주말은 다음 월요일", () => {
    expect(myDay("2026-10-26", facts({ pause: { note: "학회" } }))).toEqual([{ session: "오전", title: "쉬는 날 — 학회", lines: [] }]);
    expect(scheduleDay("2026-10-25")).toBe("2026-10-26");
    expect(scheduleDay("2026-10-24")).toBe("2026-10-26");
    expect(scheduleDay("2026-10-27")).toBe("2026-10-27");
  });

  it("교수님 근무: 그날 외래·수술 0이면 휴진일 수 있음 + 다른 교수님 수술 참관, 자료 자체가 없으면 자료 없음", () => {
    const off = myDay("2026-10-26", facts({ profs: [{ doctor: "문수진", outpatient: 10, surgeries: [op("TM")] }] }));
    expect(off[0].lines[0]).toMatchObject({ text: "박지환 교수님 그날 외래·수술 0 — 휴진일 수 있음(확인 필요)" });
    expect(off[0].lines[2]).toMatchObject({ type: "surgeries", prof: "문수진" });
    const opdOff = myDay("2026-10-28", facts({ profs: [{ doctor: "문수진", outpatient: 10, surgeries: [] }] }));
    expect(opdOff[1].lines[0]).toMatchObject({ text: "박지환 교수님 그날 외래·수술 0 — 휴진일 수 있음(확인 필요)" });
    expect(myDay("2026-10-26", facts())[0].lines[0]).toMatchObject({ muted: true, text: "올라온 자료 없음(병원 PC가 평일 아침 2주치를 올림)" });
    expect(myDay("2026-10-26", facts({ profs: [{ doctor: "박지환", outpatient: 7, surgeries: [] }] }))[0].lines[0]).toMatchObject({ text: "박지환 교수님 수술 없음(외래 7명)" });
  });

  it("교수님 부재(YES 복무현황): 휴가면 휴진 추정 대신 휴가로, 수술이 있어도 표시", () => {
    const off = myDay("2026-10-26", facts({ profs: [{ doctor: "문수진", outpatient: 1, surgeries: [], off: "휴가" }, { doctor: "박지환", outpatient: 0, surgeries: [op("ESS")] }] }));
    expect(off[1].lines[0]).toMatchObject({ text: "문수진 교수님 휴가" });
    expect(off[0].lines[0]).toMatchObject({ type: "surgeries" });
    const opWithHalf = myDay("2026-10-26", facts({ profs: [{ doctor: "박지환", outpatient: 0, surgeries: [op("ESS")], off: "반일 휴가" }] }));
    expect(opWithHalf[0].lines.map((l) => l.type)).toEqual(["text", "surgeries"]);
    expect(myDay("2026-10-30", facts({ profs: [{ doctor: "문수진", outpatient: 0, surgeries: [], off: "출장" }] }))[0].lines[0]).toMatchObject({ text: "문수진 교수님 출장" });
    expect(profSurgeryTags([{ doctor: "문수진", outpatient: 0, surgeries: [], off: "휴가" }, { doctor: "박지환", outpatient: 3, surgeries: [op("a")], off: null }])).toBe("문 휴 · 박 1");
  });

  it("달력 칸: 교수님별 수술 수", () => {
    expect(profSurgeryTags([{ doctor: "박지환", outpatient: 9, surgeries: [op("a")] }, { doctor: "문수진", outpatient: 3, surgeries: [op("b")] }, { doctor: "최성욱", outpatient: 1, surgeries: [] }])).toBe("박 1 · 문 1");
  });
});
