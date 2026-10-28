import { describe, expect, it } from "vitest";
import { buildIcsFeed } from "./calendar";
import { deptRowToEvents, maskPatientName, type DeptScheduleRow } from "./dept-calendar-feed";

const updatedAt = new Date("2026-10-28T03:00:00.000Z");
const row = (p: Partial<DeptScheduleRow>): DeptScheduleRow => ({
  date: "2026-10-29",
  doctor: "문수진",
  outpatient: 0,
  outpatientAm: null,
  outpatientPm: null,
  surgeries: [],
  off: null,
  updatedAt,
  ...p,
});
const surgery = (p: Record<string, string>) => ({ name: "홍길동", age: "54", sex: "M", chartNo: "12345678", op: "Both ESS", ...p });

describe("비과 일정 피드 — 환자 이름 가리기", () => {
  it("첫 글자와 끝 글자만 남기고 가운데를 *로", () => {
    expect(maskPatientName("홍길동")).toBe("홍*동");
    expect(maskPatientName("남궁민수")).toBe("남**수");
    expect(maskPatientName("김수")).toBe("김*");
    expect(maskPatientName(" 홍길동 ")).toBe("홍*동");
  });

  it("병원 PC가 이미 가린 이름은 그대로", () => {
    expect(maskPatientName("홍*동")).toBe("홍*동");
  });
});

describe("비과 일정 피드 — 일정 만들기", () => {
  it("수술: [교수님] 수술 방 · 가린 이름 수술명, 등록번호·나이·성별은 넣지 않는다", () => {
    const evs = deptRowToEvents(row({ surgeries: [surgery({ room: "3" })] }));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ uid: "dept-2026-10-29-%EB%AC%B8%EC%88%98%EC%A7%84-op1@ess-septo", title: "[문수진] 수술 3번방 · 홍*동 Both ESS", updatedAt });
    expect(evs[0].start).toBeUndefined();
    expect(JSON.stringify(evs)).not.toMatch(/홍길동|12345678|54/);
  });

  it("오전/오후가 있는 수술은 그 시간대(서울 09–12 / 13–17) 일정으로", () => {
    const [am, pm] = deptRowToEvents(row({ surgeries: [surgery({ half: "오전" }), surgery({ name: "남궁민수", half: "오후", room: "Room 5" })] }));
    expect(am.title).toBe("[문수진] 오전 수술 · 홍*동 Both ESS");
    expect(am.start?.toISOString()).toBe("2026-10-29T00:00:00.000Z");
    expect(am.end?.toISOString()).toBe("2026-10-29T03:00:00.000Z");
    expect(pm.title).toBe("[문수진] 오후 수술 5번방 · 남**수 Both ESS");
    expect(pm.start?.toISOString()).toBe("2026-10-29T04:00:00.000Z");
    expect(pm.end?.toISOString()).toBe("2026-10-29T08:00:00.000Z");
  });

  it("취소된 방(66·77·88·99) 수술은 빼고, 순번 UID는 남은 수술 기준", () => {
    const evs = deptRowToEvents(row({ surgeries: [surgery({ room: "66" }), surgery({ name: "김수", room: "2" })] }));
    expect(evs.map((e) => e.title)).toEqual(["[문수진] 수술 2번방 · 김* Both ESS"]);
    expect(evs[0].uid).toMatch(/-op1@ess-septo$/);
  });

  it("오전/오후 외래 인원이 있으면 시간대 일정으로, 0명인 쪽은 뺀다", () => {
    const evs = deptRowToEvents(row({ doctor: "박지환", outpatient: 12, outpatientAm: 12, outpatientPm: 0 }));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ title: "[박지환] 오전 외래 12명" });
    expect(evs[0].uid).toMatch(/-am@ess-septo$/);
    expect(evs[0].start?.toISOString()).toBe("2026-10-29T00:00:00.000Z");
  });

  it("외래 합계만 있으면 종일 일정, 0명이면 일정 없음", () => {
    expect(deptRowToEvents(row({ outpatient: 23 })).map((e) => e.title)).toEqual(["[문수진] 외래 23명"]);
    expect(deptRowToEvents(row({}))).toEqual([]);
  });

  it("부재는 종일 일정, 오전/오후 모르는 반차는 그렇게 적는다", () => {
    expect(deptRowToEvents(row({ doctor: "최성욱", off: "연차" }))[0]).toMatchObject({ title: "[최성욱] 연차", uid: expect.stringMatching(/-off@ess-septo$/) });
    expect(deptRowToEvents(row({ off: "반차" }))[0].title).toBe("[문수진] 반차(오전/오후 미확인)");
  });

  it("같은 내용이면 다시 올려도 UID가 같다(캘린더에서 겹치지 않게)", () => {
    const r = row({ outpatient: 5, off: "출장", surgeries: [surgery({})] });
    expect(deptRowToEvents({ ...r, updatedAt: new Date() }).map((e) => e.uid)).toEqual(deptRowToEvents(r).map((e) => e.uid));
  });

  it("ICS에는 시각 일정이 UTC 시각으로, 종일 일정은 날짜로 들어간다", () => {
    const ics = buildIcsFeed({ calendarName: "비과 일정", events: deptRowToEvents(row({ outpatientPm: 7, off: "오전 반차" })) });
    expect(ics).toContain("DTSTART:20261029T040000Z");
    expect(ics).toContain("DTEND:20261029T080000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261029");
    expect(ics).toContain("SUMMARY:[문수진] 오후 외래 7명");
  });
});
