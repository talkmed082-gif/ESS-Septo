import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// 가상 데이터만 쓴다(실명·실제 등록번호 금지).
vi.mock("@/app/actions/reminders", () => ({ setReminderDone: vi.fn(), deleteReminderFromList: vi.fn() }));
const { ProfTable } = await import("./prof-table");
const { clinicTabs, SETTINGS_TABS } = await import("./section-tabs");
const { ReminderList } = await import("../app/(app)/reminders/reminder-list");
const { ProfScheduleBodySchema } = await import("@/lib/prof-schedule");

const text = (html: string) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("메인 교수님 2주 표", () => {
  it("평일만, 외래·수술·휴가 종류, 취소된 수술은 따로", () => {
    const profs = new Map([
      ["2026-10-28", [
        { doctor: "문수진", outpatient: 0, surgeries: [], cancelled: [{ name: "가*나", op: "ESS", room: "66" }], off: null },
        { doctor: "박지환", outpatient: 12, surgeries: [{ name: "다*라", op: "TSA", room: "05" }], cancelled: [], off: "오후 반차" },
      ]],
    ]);
    const t = text(renderToString(<ProfTable dates={["2026-10-25", "2026-10-28"]} today="2026-10-28" profs={profs as never} />));
    expect(t).not.toContain("10/25"); // 일요일 빠짐
    expect(t).toContain("10/28(수)");
    expect(t).toContain("오후 반차 외래 12 수술 1");
    expect(t).toContain("취소 1");
  });
  it("병원 PC가 올리는 휴가 종류(오전/오후 반차·연차)를 받는다", () => {
    const body = { from: "2026-10-28", to: "2026-10-28", items: [{ date: "2026-10-28", doctor: "문수진", outpatient: 0, surgeries: [], off: "연차" }] };
    expect(ProfScheduleBodySchema.safeParse(body).success).toBe(true);
    expect(ProfScheduleBodySchema.safeParse({ ...body, items: [{ ...body.items[0], off: "병가" }] }).success).toBe(false);
  });
});

describe("메뉴·탭", () => {
  it("외래 진료 관리 탭은 고른 날짜를 들고 다닌다", () => {
    expect(clinicTabs("2026-10-28").map((t) => `${t.label}:${t.href}`)).toEqual(["외래 전 준비:/outpatient?date=2026-10-28", "외래 진행 중:/clinic?date=2026-10-28", "외래 후:/cpap?date=2026-10-28"]);
    expect(SETTINGS_TABS.map((t) => t.label)).toEqual(["일반", "외래", "수술", "병원 연동", "엑셀 가져오기"]);
  });
});

describe("일정 알림", () => {
  it("남은 것과 완료를 나누고, 사이트에서 만든 것만 삭제 버튼", () => {
    const base = { due: "2026-10-30", late: false, content: null, authorName: null, patient: { id: "p", name: "가*나", chartNo: "1" } };
    const t = text(renderToString(<ReminderList items={[
      { ...base, id: "a", title: "Silastic 제거", done: false, deletable: true },
      { ...base, id: "b", title: "EMR 알림", done: false, deletable: false },
      { ...base, id: "c", title: "끝난 것", done: true, deletable: true },
    ]} />));
    expect(t).toContain("Silastic 제거");
    expect(t).toContain("완료 1건");
    expect(t.match(/삭제/g)?.length).toBe(2); // a와 c(완료 안쪽)만
  });
});
