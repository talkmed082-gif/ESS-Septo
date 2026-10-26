import { describe, expect, it } from "vitest";
import { AutomationPauseSchema, carryOverSoap, checkConsultReply, ConsultBodySchema, consultKey, consultNoteId, ConsultReplyResultSchema, consultReplyUpdate, findPause, kstDate, mergeOutpatientSoap, searchOutpatientHistory, OutpatientListBodySchema, OutpatientSoapBodySchema, PcJobBodySchema, pcJobState, TsaRunBodySchema, validateTsaScanRange } from "@/lib/hospital-link";

// 2026-10-14 16:00 UTC = 10/15 01:00 KST
const NOW = new Date("2026-10-14T16:00:00Z");

describe("kstDate", () => {
  it("한국 시간 기준 날짜를 쓴다(UTC 자정 전후가 갈리는 시각)", () => {
    expect(kstDate(NOW)).toBe("2026-10-15");
    expect(kstDate(NOW, 1)).toBe("2026-10-16");
    expect(kstDate(new Date("2026-10-14T14:59:00Z"))).toBe("2026-10-14");
  });
});

describe("ConsultBodySchema", () => {
  const item = {
    noteId: "12345678",
    chartNo: "00123456",
    patientName: "홍*동",
    sexAge: "M/45",
    location: "71병동",
    requestedAt: "2026-10-26 11:31",
    fromDept: "내과",
    fromDoctor: "김의사",
    emergency: false,
    content: "의뢰 내용\n두 번째 줄",
    diagnosis: "진단",
    replied: false,
    repliedAt: "",
  };
  it("병원 PC가 올리는 목록(0건 포함)을 받는다", () => {
    expect(ConsultBodySchema.safeParse({ from: "2026-09-26", to: "2026-10-26", items: [item] }).success).toBe(true);
    expect(ConsultBodySchema.safeParse({ from: "2026-09-26", to: "2026-10-26", items: [] }).success).toBe(true);
  });
  it("의뢰 번호가 없거나 날짜 형식이 틀리면 막는다", () => {
    expect(ConsultBodySchema.safeParse({ from: "2026-09-26", to: "2026-10-26", items: [{ ...item, noteId: "" }] }).success).toBe(false);
    expect(ConsultBodySchema.safeParse({ from: "9/26", to: "2026-10-26", items: [] }).success).toBe(false);
  });
  it("키는 등록번호-의뢰 번호", () => {
    expect(consultKey(item)).toBe("00123456-12345678");
  });
  it("키에서 의뢰 번호를 되찾는다(등록번호가 다르면 빈 값)", () => {
    expect(consultNoteId({ chartNo: "00123456", emrKey: "00123456-12345678" })).toBe("12345678");
    expect(consultNoteId({ chartNo: "999", emrKey: "00123456-12345678" })).toBe("");
  });
});

describe("checkConsultReply", () => {
  it("앞뒤 공백을 정리하고 줄바꿈은 둔다", () => {
    expect(checkConsultReply("  가\r\n나  ")).toEqual({ text: "가\n나" });
  });
  it("빈 글과 너무 긴 글은 막는다", () => {
    expect(checkConsultReply("   ")).toHaveProperty("error");
    expect(checkConsultReply("가".repeat(4001))).toHaveProperty("error");
  });
});

describe("consultReplyUpdate", () => {
  const base = { id: "c1", requestedAt: "2026-10-26T03:00:00.000Z" };
  const now = new Date("2026-10-26T04:00:00Z");
  it("저장·서명 → SIGNED, 기록지 번호와 서명 시각", () => {
    expect(consultReplyUpdate({ ...base, ok: true, signed: true, doctorNoteId: "123" }, now)).toEqual({
      replyStatus: "SIGNED",
      replyMessage: null,
      replyDoctorNoteId: "123",
      replySignedAt: now,
    });
  });
  it("저장만 됨(서명 못 함) → SAVED, 이유 남김", () => {
    expect(consultReplyUpdate({ ...base, ok: true, signed: false, doctorNoteId: "123", message: "비밀번호 필요" }, now)).toEqual({
      replyStatus: "SAVED",
      replyMessage: "비밀번호 필요",
      replyDoctorNoteId: "123",
    });
  });
  it("저장 실패 → FAILED", () => {
    expect(consultReplyUpdate({ ...base, ok: false, message: "칸에 글 있음" }, now)).toEqual({ replyStatus: "FAILED", replyMessage: "칸에 글 있음" });
  });
});

describe("ConsultReplyResultSchema", () => {
  it("기록지 번호는 숫자만", () => {
    expect(ConsultReplyResultSchema.safeParse({ id: "c1", requestedAt: "2026-10-26T03:00:00.000Z", ok: true, doctorNoteId: "12a" }).success).toBe(false);
  });
  it("병원 PC 결과(성공·실패)를 받는다", () => {
    expect(ConsultReplyResultSchema.safeParse({ id: "c1", requestedAt: "2026-10-26T03:00:00.000Z", ok: true }).success).toBe(true);
    expect(ConsultReplyResultSchema.safeParse({ id: "c1", requestedAt: "2026-10-26T03:00:00.000Z", ok: false, message: "칸에 이미 글 있음" }).success).toBe(true);
    expect(ConsultReplyResultSchema.safeParse({ id: "c1", ok: true }).success).toBe(false);
  });
});

describe("validateTsaScanRange", () => {
  it("내일까지는 된다", () => {
    expect(validateTsaScanRange("2026-09-01", "2026-10-16", NOW)).toBeNull();
  });
  it("내일보다 뒤는 막는다(미래 TSA는 신경외과만 넣어 뒀을 수 있음)", () => {
    expect(validateTsaScanRange("2026-10-01", "2026-10-17", NOW)).toMatch(/내일\(2026-10-16\)/);
  });
  it("시작이 끝보다 뒤면 막는다", () => {
    expect(validateTsaScanRange("2026-10-10", "2026-10-01", NOW)).toMatch(/시작 날짜/);
  });
  it("92일 넘는 기간은 막는다", () => {
    expect(validateTsaScanRange("2026-07-01", "2026-10-15", NOW)).toMatch(/92일/);
    expect(validateTsaScanRange("2026-07-16", "2026-10-15", NOW)).toBeNull();
  });
  it("날짜 형식이 아니면 막는다", () => {
    expect(validateTsaScanRange("", "2026-10-15", NOW)).toMatch(/날짜를/);
  });
});

describe("병원 PC 요청 형식", () => {
  it("TSA 결과: 보류·중복에 이름 칸이 없어도 받는다", () => {
    const ok = TsaRunBodySchema.safeParse({
      kind: "RANGE",
      from: "2026-09-01",
      to: "2026-10-15",
      found: 7,
      added: 0,
      skipped: 6,
      held: [{ date: "2026-09-23", chart4: "2886", rows: [325] }],
      dups: [],
      requestedAt: "2026-10-14T07:00:00.000Z",
    });
    expect(ok.success).toBe(true);
  });
  it("외래 명단: 날짜 형식이 틀리면 거절", () => {
    expect(OutpatientListBodySchema.safeParse({ date: "10/15", clinic: "x", rows: [] }).success).toBe(false);
  });
});

describe("pcJobState", () => {
  const now = new Date("2026-10-15T09:00:00Z");
  const h = (hours: number) => new Date(now.getTime() - hours * 3600000);
  it("실패 > 늦음 > 정상, 기록 없으면 none", () => {
    expect(pcJobState(undefined, 80, now)).toBe("none");
    expect(pcJobState({ lastRunAt: h(1), lastOk: false }, 80, now)).toBe("fail");
    expect(pcJobState({ lastRunAt: h(81), lastOk: true }, 80, now)).toBe("late");
    expect(pcJobState({ lastRunAt: h(79), lastOk: true }, 80, now)).toBe("ok");
    expect(pcJobState({ lastRunAt: h(1000), lastOk: true }, null, now)).toBe("ok"); // 요청 시에만 도는 작업
  });
  it("작업 이름이 목록에 없으면 거절", () => {
    expect(PcJobBodySchema.safeParse({ job: "SURGERY_DAILY", ok: true }).success).toBe(true);
    expect(PcJobBodySchema.safeParse({ job: "WHATEVER", ok: true }).success).toBe(false);
  });
});

describe("외래 SOAP 붙이기", () => {
  const rows = [
    { time: "09:00", name: "홍*동", chartNo: "111", visit: "재진", diagnosis: "CRS" },
    { time: "09:10", name: "김*수", chartNo: "222", visit: "초진", diagnosis: "DNS" },
  ];
  it("등록번호가 같은 행에만 붙이고, 명단에 없는 번호는 버림", () => {
    const r = mergeOutpatientSoap(rows, [{ chartNo: "222", soap: "S: x" }, { chartNo: "999", soap: "S: y" }]);
    expect(r.matched).toBe(1);
    expect(r.rows[1].soap).toBe("S: x");
    expect(r.rows[0].soap).toBeUndefined();
  });
  it("로드맵도 같이 붙이고, 로드맵이 안 온 항목은 있던 로드맵을 둔다", () => {
    const withRoadmap = [{ ...rows[0], roadmap: "옛 로드맵" }, rows[1]];
    const r = mergeOutpatientSoap(withRoadmap, [
      { chartNo: rows[0].chartNo, soap: "S: a" },
      { chartNo: rows[1].chartNo, soap: "S: b", roadmap: "경과: x" },
    ]);
    expect(r.rows[0]).toMatchObject({ soap: "S: a", roadmap: "옛 로드맵" });
    expect(r.rows[1]).toMatchObject({ soap: "S: b", roadmap: "경과: x" });
    expect(OutpatientSoapBodySchema.safeParse({ date: "2026-10-20", items: [{ chartNo: "1", soap: "a", roadmap: "b" }] }).success).toBe(true);
  });
  it("형식 검사: 날짜 꼴·빈 등록번호 거절", () => {
    expect(OutpatientSoapBodySchema.safeParse({ date: "2026-10-20", items: [{ chartNo: "1", soap: "a" }] }).success).toBe(true);
    expect(OutpatientSoapBodySchema.safeParse({ date: "10/20", items: [] }).success).toBe(false);
    expect(OutpatientSoapBodySchema.safeParse({ date: "2026-10-20", items: [{ chartNo: "", soap: "a" }] }).success).toBe(false);
  });
});

describe("외래 명단 새로 고침·검색", () => {
  const row = (chartNo: string, soap?: string) => ({ time: "09:00", name: "홍*동", chartNo, visit: "재진", diagnosis: "CRS", ...(soap ? { soap } : {}) });
  it("다시 올려도 같은 등록번호의 SOAP는 유지, 새 환자는 SOAP 없음, 빠진 환자는 빠짐", () => {
    const r = carryOverSoap([row("111", "S: a"), row("222", "S: b")], [row("111"), row("333")]);
    expect(r).toEqual([row("111", "S: a"), row("333")]);
  });
  it("다시 올려도 로드맵도 등록번호로 유지", () => {
    const r = carryOverSoap([{ ...row("111", "S: a"), roadmap: "경과: a" }, { ...row("222"), roadmap: "경과: b" }], [row("111"), row("222")]);
    expect(r).toEqual([{ ...row("111", "S: a"), roadmap: "경과: a" }, { ...row("222"), roadmap: "경과: b" }]);
  });
  it("새 행에 SOAP가 있으면 그것을 씀", () => {
    expect(carryOverSoap([row("111", "old")], [row("111", "new")])[0].soap).toBe("new");
  });
  it("등록번호 일부(4자리 이상)로 최근 날짜부터", () => {
    const lists = [
      { date: "2026-10-16", clinic: "A", rows: [row("106383650")] },
      { date: "2026-10-20", clinic: "B", rows: [row("106383650", "S"), row("999999999")] },
    ];
    const r = searchOutpatientHistory(lists, "3650");
    expect(r.map((h) => h.date)).toEqual(["2026-10-20", "2026-10-16"]);
    expect(searchOutpatientHistory(lists, "365")).toEqual([]);
  });
});

describe("자동화 쉬는 날", () => {
  const pauses = [{ from: "2026-10-26", to: "2026-10-28", note: "학회" }, { from: "2026-11-02", to: "2026-11-02" }];
  it("기간 안(양 끝 포함)이면 그 기간, 밖이면 없음", () => {
    expect(findPause(pauses, "2026-10-26")?.note).toBe("학회");
    expect(findPause(pauses, "2026-10-28")?.note).toBe("학회");
    expect(findPause(pauses, "2026-10-29")).toBeUndefined();
    expect(findPause(pauses, "2026-11-02")).toBeDefined();
    expect(findPause([], "2026-11-02")).toBeUndefined();
  });
  it("형식: 끝이 시작보다 앞이거나 92일 넘으면 거절", () => {
    expect(AutomationPauseSchema.safeParse({ from: "2026-10-26", to: "2026-10-26" }).success).toBe(true);
    expect(AutomationPauseSchema.safeParse({ from: "2026-10-28", to: "2026-10-26" }).success).toBe(false);
    expect(AutomationPauseSchema.safeParse({ from: "2026-01-01", to: "2026-06-01" }).success).toBe(false);
    expect(AutomationPauseSchema.safeParse({ from: "10/26", to: "2026-10-26" }).success).toBe(false);
  });
});
