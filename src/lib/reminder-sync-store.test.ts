import { beforeEach, describe, expect, it, vi } from "vitest";

// 가상 데이터만 쓴다(실명·실제 등록번호 금지).
const db = vi.hoisted(() => ({
  findFirstPatient: vi.fn(),
  findManyReminders: vi.fn(),
  updateManyReminders: vi.fn(),
  updateReminder: vi.fn(),
  createReminder: vi.fn(),
  deleteManyReminders: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: { findFirst: db.findFirstPatient },
    user: { updateMany: db.updateUser },
    reminder: {
      findMany: db.findManyReminders,
      updateMany: db.updateManyReminders,
      update: db.updateReminder,
      create: db.createReminder,
      deleteMany: db.deleteManyReminders,
    },
  },
}));

import { applyReminderSync } from "./reminder-sync-store";

const T = "2026-10-13T10:00:00.000Z";

const emr = (regSeq: string, title = "술후 외래") => ({
  regDate: "2026-10-13",
  regSeq,
  author: "작성자",
  title,
  dueDate: "2026-10-30",
  content: "내용",
});

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset());
  db.findFirstPatient.mockResolvedValue({ id: "p1" });
  db.findManyReminders.mockResolvedValue([]);
  db.updateManyReminders.mockResolvedValue({ count: 1 });
  db.deleteManyReminders.mockResolvedValue({ count: 0 });
});

describe("applyReminderSync", () => {
  it("EMR에 올린 이 사이트 리마인더에 EMR 등록일·순번을 붙인다(아직 안 붙은 것만)", async () => {
    const res = await applyReminderSync("u1", {
      pushed: [{ id: "r1", regDate: "2026-10-13", regSeq: "3" }],
      patients: [],
      startedAt: T,
    });
    expect(db.updateManyReminders).toHaveBeenCalledWith({
      where: { id: "r1", createdById: "u1", emrRegSeq: null },
      data: { emrRegDate: "2026-10-13", emrRegSeq: "3" },
    });
    expect(res.linked).toBe(1);
  });

  it("처음 보는 EMR 리마인더는 EMR 출처로 만들고, 이미 있는 것은 내용만 갱신한다", async () => {
    db.findManyReminders.mockResolvedValue([
      { id: "old", emrRegDate: "2026-10-13", emrRegSeq: "1" },
    ]);
    const res = await applyReminderSync("u1", {
      pushed: [],
      patients: [
        { chartNo: "00000001", reminders: [emr("1", "바뀐 제목"), emr("2")] },
      ],
      startedAt: T,
    });
    expect(db.findFirstPatient).toHaveBeenCalledWith({
      where: { chartNo: "00000001", createdById: "u1" },
      select: { id: true },
    });
    expect(db.updateReminder.mock.calls[0][0]).toMatchObject({
      where: { id: "old" },
      data: { title: "바뀐 제목" },
    });
    expect(db.createReminder.mock.calls[0][0].data).toMatchObject({
      patientId: "p1",
      source: "EMR",
      emrRegDate: "2026-10-13",
      emrRegSeq: "2",
      createdById: "u1",
      dueDate: new Date("2026-10-30"),
    });
    expect(res).toMatchObject({ created: 1, updated: 1, deleted: 0 });
  });

  it("EMR 목록에서 사라진 리마인더는 여기서도 지운다", async () => {
    db.findManyReminders.mockResolvedValue([
      { id: "keep", emrRegDate: "2026-10-13", emrRegSeq: "1" },
      { id: "gone", emrRegDate: "2026-10-13", emrRegSeq: "2" },
    ]);
    db.deleteManyReminders.mockResolvedValue({ count: 1 });
    const res = await applyReminderSync("u1", {
      pushed: [],
      patients: [{ chartNo: "00000001", reminders: [emr("1")] }],
      startedAt: T,
    });
    expect(db.deleteManyReminders).toHaveBeenCalledWith({
      where: { id: { in: ["gone"] }, createdById: "u1" },
    });
    expect(res.deleted).toBe(1);
  });

  it("동기화를 시작하기 전에 누른 요청만 지운다(도중에 새로 누른 요청은 남는다)", async () => {
    await applyReminderSync("u1", { pushed: [], patients: [], startedAt: T });
    expect(db.updateUser).toHaveBeenCalledWith({
      where: { id: "u1", reminderSyncRequestedAt: { lte: new Date(T) } },
      data: { reminderSyncRequestedAt: null },
    });
  });

  it("이 계정에 없는 등록번호는 건너뛴다", async () => {
    db.findFirstPatient.mockResolvedValue(null);
    await applyReminderSync("u1", {
      pushed: [],
      patients: [{ chartNo: "99999999", reminders: [emr("1")] }],
      startedAt: T,
    });
    expect(db.createReminder).not.toHaveBeenCalled();
    expect(db.deleteManyReminders).not.toHaveBeenCalled();
  });
});
