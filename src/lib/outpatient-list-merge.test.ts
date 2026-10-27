import { beforeEach, describe, expect, it, vi } from "vitest";

// 가상 데이터만 쓴다(실명·실제 등록번호 금지).
const db = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { outpatientList: { findUnique: db.findUnique, upsert: db.upsert } } }));

import { saveOutpatientList } from "./hospital-link-store";

const row = (time: string, chartNo: string, soap?: string) => ({ time, name: "가*나", chartNo, visit: "재진", diagnosis: "", ...(soap ? { soap } : {}) });

describe("명단 [새로고침] — merge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("진료 마쳐 EMR 명단에서 빠진 환자는 남기고, 새 환자는 더하고, SOAP는 유지, 시간순", async () => {
    db.findUnique.mockResolvedValue({ rows: [row("13:30", "1001", "S1"), row("14:00", "1002", "S2")] });
    const r = await saveOutpatientList("u", { date: "2026-10-27", clinic: "c", rows: [row("14:00", "1002"), row("13:45", "1003")], merge: true });
    const rows = db.upsert.mock.calls[0][0].update.rows as { chartNo: string; soap?: string }[];
    expect(rows.map((x) => x.chartNo)).toEqual(["1001", "1003", "1002"]);
    expect(rows.find((x) => x.chartNo === "1002")?.soap).toBe("S2");
    expect(r.count).toBe(3);
  });

  it("merge 없이(아침 새로 고침)는 예전처럼 새 명단으로 덮어씀", async () => {
    db.findUnique.mockResolvedValue({ rows: [row("13:30", "1001"), row("14:00", "1002")] });
    await saveOutpatientList("u", { date: "2026-10-27", clinic: "c", rows: [row("14:00", "1002")] });
    expect((db.upsert.mock.calls[0][0].update.rows as { chartNo: string }[]).map((x) => x.chartNo)).toEqual(["1002"]);
  });

  it("빈 명단으로 merge해도 기존 환자는 지워지지 않음", async () => {
    db.findUnique.mockResolvedValue({ rows: [row("13:30", "1001")] });
    await saveOutpatientList("u", { date: "2026-10-27", clinic: "c", rows: [], merge: true });
    expect((db.upsert.mock.calls[0][0].update.rows as { chartNo: string }[]).map((x) => x.chartNo)).toEqual(["1001"]);
  });
});
