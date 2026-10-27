import { describe, expect, it } from "vitest";
import { CpapUploadSchema, cpapDue, cpapMailQuery, cpapNoticeText, cpapObjectiveText, cpapResultText, cpapRxText, pressureOf, isCpapFollowUp, smsHref } from "./cpap";

describe("CPAP F/U", () => {
  it("처방일 + 개월 = 기간 끝", () => {
    expect(cpapDue({ rxDate: "2026-04-27", months: 6 })).toBe("2026-10-27");
    expect(cpapDue({ rxDate: "2026-05-12", months: 3 })).toBe("2026-08-12");
    expect(cpapDue({ rxDate: null, months: 3 })).toBeNull();
  });
  it("기간이 지나(2주 일찍까지) 오는 외래만 F/U", () => {
    expect(isCpapFollowUp({ rxDate: "2026-04-27", months: 6 }, "2026-10-27")).toBe(true);
    expect(isCpapFollowUp({ rxDate: "2026-04-27", months: 6 }, "2026-10-14")).toBe(true);
    expect(isCpapFollowUp({ rxDate: "2026-04-27", months: 6 }, "2026-10-12")).toBe(false);
    expect(isCpapFollowUp({ rxDate: "2026-05-12", months: 3 }, "2026-10-27")).toBe(true);
    expect(isCpapFollowUp({ rxDate: null, months: null }, "2026-10-27")).toBe(false);
  });
  it("올리기 형식: 약자는 영어 대문자 두 글자", () => {
    expect(CpapUploadSchema.safeParse({ items: [{ chartNo: "12345678", cpap: { vendor: "YT", rxDate: "2026-05-12", months: 3 } }] }).success).toBe(true);
    expect(CpapUploadSchema.safeParse({ items: [{ chartNo: "12345678", cpap: { vendor: "yt" } }] }).success).toBe(false);
  });
});

describe("양압기 회사 문자·메일", () => {
  it("처방 의뢰 문자(사용자 문구)", () => {
    expect(cpapRxText({ name: "홍길동", sex: "남", age: "45세", phone: "010-0000-0000", ahi: "32.5" })).toBe(
      "안녕하세요 양산부산대병원 이비인후과 정일구입니다. 홍길동님 남/45세, 010-0000-0000, AHI 32.5 환자 의뢰드립니다.\n잘 부탁드립니다.",
    );
  });
  it("결과 요청 문자 — 오늘이면 '오늘', 아니면 날짜", () => {
    expect(cpapResultText({ name: "홍길동", visitDate: "2026-10-27", today: "2026-10-27" })).toBe(
      "안녕하세요. 양산부산대병원 비과전임의 정일구입니다. 오늘 외래 예정인 홍길동 환자분 양압기 결과 보내주실 수 있으실까요? 제 메일 주소는 ilguuu@gmail.com 입니다.",
    );
    expect(cpapResultText({ name: "홍길동", visitDate: "2026-10-30", today: "2026-10-27" })).toContain("10/30 외래 예정인");
  });
  it("문자 주소는 하이픈 빼고 본문 인코딩", () => {
    expect(smsHref("010-3562-0915", "가 나")).toBe("sms:01035620915?&body=%EA%B0%80%20%EB%82%98");
  });
  it("메일 검색어 — 받은 회사는 보낸 주소, 아니면 양압기/CPAP + 이름, 실명 없으면 안 찾음", () => {
    expect(cpapMailQuery({ vendor: "FP", realName: "홍길동", rxDate: "2026-04-27" }, "2026-10-27")).toBe('from:busan@slmedicare.co.kr after:2026/04/27 "홍길동"');
    expect(cpapMailQuery({ vendor: "BG", realName: "홍길동", rxDate: null }, "2026-10-27")).toBe('(양압기 OR CPAP) after:2026/08/28 "홍길동"');
    expect(cpapMailQuery({ vendor: "FP", realName: null, rxDate: "2026-04-27" }, "2026-10-27")).toBeNull();
  });
});
describe("CPAP 결과 → Objective 글", () => {
  const report = { text: "@ CPAP data (26.04.26~26.10.25):\n사용 98.9%\nAHI 4.8", expiry: "2026. 10. 25", kind: "순응기간 후 처방중", at: "" };
  it("PSG AHI를 알면 'AHI PSG -> 잔여', 처방만료일 줄", () => {
    expect(cpapObjectiveText({ report, psgAhi: "45.0" })).toBe("@ CPAP data (26.04.26~26.10.25):\n사용 98.9%\nAHI 45.0 (PSG) -> 4.8\n처방만료일 2026. 10. 25");
  });
  it("PSG AHI 모르면 그대로, 결과 없으면 null", () => {
    expect(cpapObjectiveText({ report, psgAhi: null })).toContain("\nAHI 4.8\n");
    expect(cpapObjectiveText({ report: null, psgAhi: "45.0" })).toBeNull();
  });
});
describe("외래 후 처방 안내 문자", () => {
  it("사용자 문구 — 압력을 바꾸면 '압력 ○으로 변경해서'", () => {
    expect(cpapNoticeText({ name: "가나다", months: 3, pressure: null })).toBe("가나다님 3개월 추가 처방했습니다.");
    expect(cpapNoticeText({ name: "라마바", months: 3, pressure: "6-10" })).toBe("라마바님 압력 6-10으로 변경해서 3개월 추가 처방했습니다.");
    expect(pressureOf("Pr 4-12")).toBe("4-12");
    expect(pressureOf(null)).toBe("");
  });
});