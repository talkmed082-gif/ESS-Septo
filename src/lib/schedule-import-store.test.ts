import { beforeEach, describe, expect, it, vi } from "vitest";

// 가상 데이터만 쓴다(실명·실제 등록번호 금지).
const db = vi.hoisted(() => ({
  findManyTypes: vi.fn(),
  findFirstPlan: vi.fn(),
  findFirstPatient: vi.fn(),
  createPatient: vi.fn(),
  createPlan: vi.fn(),
  updateManyPlan: vi.fn(),
  findManyPlan: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    surgeryType: { findMany: db.findManyTypes },
    opPlan: { findFirst: db.findFirstPlan, updateMany: db.updateManyPlan, findMany: db.findManyPlan },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        patient: { findFirst: db.findFirstPatient, create: db.createPatient },
        opPlan: { create: db.createPlan },
      }),
  },
}));

import { importScheduleRows } from "./schedule-import-store";

const user = { id: "u1", name: "정일구" };
const row = {
  date: "2026-10-16",
  room: "Room05",
  order: "1",
  surgeon: "정일구",
  assist: "",
  chartNo: "00000001",
  name: "가나다",
  sex: "M",
  age: "54Y",
  diagnosis: "",
  procedure: "Endoscopic sinus surgery (B)",
  anesthesia: "전신",
  duration: "",
  note: "",
};

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset());
  db.findManyTypes.mockResolvedValue([{ id: "t-ess", code: "ESS" }]);
  db.findFirstPlan.mockResolvedValue(null);
  db.findManyPlan.mockResolvedValue([]);
  db.createPatient.mockResolvedValue({ id: "p-new" });
});

describe("importScheduleRows", () => {
  it("등록번호가 같은 기존 환자가 있으면 새로 만들지 않고 그 환자에 계획을 붙인다", async () => {
    db.findFirstPatient.mockResolvedValue({ id: "p-old" });
    expect(await importScheduleRows(user, [row])).toEqual({ created: 1, skipped: 0 });
    expect(db.findFirstPatient).toHaveBeenCalledWith({ where: { chartNo: "00000001", createdById: "u1" } });
    expect(db.createPatient).not.toHaveBeenCalled();
    expect(db.createPlan.mock.calls[0][0].data).toMatchObject({
      patientId: "p-old",
      surgeryTypeId: "t-ess",
      status: "PLANNED",
      createdById: "u1",
    });
  });

  it("처음 보는 등록번호면 환자를 만들고 나이·성별을 옮긴다", async () => {
    db.findFirstPatient.mockResolvedValue(null);
    await importScheduleRows(user, [row]);
    expect(db.createPatient.mock.calls[0][0].data).toMatchObject({
      chartNo: "00000001",
      name: "가나다",
      sex: "M",
      age: 54,
      createdById: "u1",
    });
    expect(db.createPlan.mock.calls[0][0].data.patientId).toBe("p-new");
  });

  it("같은 환자·날짜·수술 계획이 이미 있으면 건너뛴다(매일 다시 보내도 중복 없음)", async () => {
    db.findFirstPlan.mockResolvedValue({ id: "plan-1" });
    expect(await importScheduleRows(user, [row])).toEqual({ created: 0, skipped: 1 });
    expect(db.createPlan).not.toHaveBeenCalled();
  });

  it("측 저장 전에 만든 기존 계획에는 스케줄 ESS 측만 채우고, 이미 있으면 건드리지 않는다", async () => {
    db.findFirstPlan.mockResolvedValue({ id: "plan-1", planData: { f_right_mma: false } });
    await importScheduleRows(user, [row]);
    expect(db.updateManyPlan).toHaveBeenCalledWith({
      where: { id: "plan-1", createdById: "u1" },
      data: { planData: { f_right_mma: false, f_sched_side: "B" } },
    });
    db.updateManyPlan.mockReset();
    db.findFirstPlan.mockResolvedValue({ id: "plan-1", planData: { f_sched_side: "B" } });
    await importScheduleRows(user, [row]);
    expect(db.updateManyPlan).not.toHaveBeenCalled();
  });

  it("외래에서 먼저 잡은 끝나지 않은 계획이 딱 하나면 새로 만들지 않고 그 계획에 EMR 날짜를 채운다(중복 없음)", async () => {
    db.findManyPlan.mockResolvedValue([{ id: "plan-clinic", plannedDate: null }]);
    expect(await importScheduleRows(user, [row])).toEqual({ created: 0, skipped: 1 });
    expect(db.updateManyPlan).toHaveBeenCalledWith({ where: { id: "plan-clinic", createdById: "u1" }, data: { plannedDate: new Date("2026-10-16"), diagnosis: undefined } });
    expect(db.createPlan).not.toHaveBeenCalled();
  });

  it("끝나지 않은 계획이 둘 이상(단계 수술 등)이면 헷갈리니 예전처럼 새로 만든다", async () => {
    db.findManyPlan.mockResolvedValue([{ id: "a", plannedDate: null }, { id: "b", plannedDate: null }]);
    db.findFirstPatient.mockResolvedValue({ id: "p-old" });
    expect(await importScheduleRows(user, [row])).toEqual({ created: 1, skipped: 0 });
    expect(db.updateManyPlan).not.toHaveBeenCalled();
  });

  it("다른 집도의 행과 지원 안 되는 수술은 건너뛴다", async () => {
    const rows = [
      { ...row, surgeon: "다른교수" },
      { ...row, procedure: "Tonsillectomy (B)" },
    ];
    expect(await importScheduleRows(user, rows)).toEqual({ created: 0, skipped: 2 });
    expect(db.createPlan).not.toHaveBeenCalled();
  });
});
