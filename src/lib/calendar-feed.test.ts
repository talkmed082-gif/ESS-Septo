import { describe, expect, it } from "vitest";
import { buildIcsFeed } from "./calendar";
import { generateCalendarToken, isCalendarTokenFormat, planToCalendarEvent } from "./calendar-feed";

const date = new Date("2026-10-05T00:00:00.000Z");
const updatedAt = new Date("2026-09-24T03:00:00.000Z");

describe("buildIcsFeed", () => {
  it("여러 일정을 하나의 VCALENDAR로 묶고 CRLF 줄바꿈으로 끝낸다", () => {
    const ics = buildIcsFeed({
      calendarName: "수술 일정",
      events: [
        { uid: "a@x", title: "Both ESS", date, updatedAt },
        { uid: "b@x", title: "Septoturbinoplasty", date, updatedAt },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("X-WR-CALNAME:수술 일정");
    expect(ics).not.toMatch(/[^\r]\n/); // 모든 줄바꿈이 CRLF
  });

  it("종일 일정(다음 날 종료)과 UID, 갱신 시각(DTSTAMP)을 넣는다", () => {
    const ics = buildIcsFeed({ calendarName: "c", events: [{ uid: "a@x", title: "T", date, updatedAt }] });
    expect(ics).toContain("UID:a@x");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261005");
    expect(ics).toContain("DTEND;VALUE=DATE:20261006");
    expect(ics).toContain("DTSTAMP:20260924T030000Z");
  });

  it("제목의 쉼표/세미콜론/줄바꿈을 이스케이프한다", () => {
    const ics = buildIcsFeed({ calendarName: "c", events: [{ uid: "a@x", title: "R] ESS(F), L] ESS;x\ny", date, updatedAt }] });
    expect(ics).toContain("SUMMARY:R] ESS(F)\\, L] ESS\\;x\\ny");
  });

  it("일정이 없어도 유효한 빈 캘린더를 돌려준다", () => {
    const ics = buildIcsFeed({ calendarName: "c", events: [] });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("planToCalendarEvent", () => {
  const surgeryType = { code: "ESS", name: "부비동내시경수술 (FESS)" };
  const base = {
    id: "plan1",
    plannedDate: date,
    updatedAt,
    status: "PLANNED",
    planData: { f_right_mma: true, f_left_mma: true },
    surgeryType,
  };

  it("기본 수술은 자동 생성한 수술명을, UID는 계획 ID로 만든다", () => {
    const ev = planToCalendarEvent(base);
    expect(ev).toMatchObject({ uid: "op-plan-plan1@ess-septo", title: "Both MMA", date, updatedAt });
  });

  it("완료된 계획은 제목 앞에 [완료]를 붙인다", () => {
    expect(planToCalendarEvent({ ...base, status: "DONE" }).title).toBe("[완료] Both MMA");
  });

  it("직접 만든 수술 종류는 그 이름을 제목으로 쓴다", () => {
    const ev = planToCalendarEvent({ ...base, surgeryType: { code: "TONSIL", name: "편도절제술" }, planData: {} });
    expect(ev.title).toBe("편도절제술");
  });

  it("환자 이름이나 메모 같은 개인정보는 일정에 들어가지 않는다", () => {
    const withPii = { ...base, patient: { name: "홍길동", chartNo: "12345" }, planNote: "비밀 메모" } as never;
    expect(JSON.stringify(planToCalendarEvent(withPii))).not.toMatch(/홍길동|12345|비밀 메모/);
  });
});

describe("캘린더 토큰", () => {
  it("URL에 안전한 43자 이상의 무작위 문자열이고 매번 다르다", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateCalendarToken()));
    expect(tokens.size).toBe(50);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43,}$/);
      expect(isCalendarTokenFormat(t)).toBe(true);
    }
  });

  it("형식이 맞지 않는 값은 거부한다", () => {
    for (const bad of ["", "short", "a b", "../../etc/passwd", "x".repeat(200), "가나다".repeat(20)]) {
      expect(isCalendarTokenFormat(bad)).toBe(false);
    }
  });
});
