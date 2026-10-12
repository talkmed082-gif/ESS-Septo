import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseScheduleWorkbook, ScheduleFormatError } from "./schedule-workbook";

const HEADER = [
  "날짜", "요일", "Room", "순번", "교수님", "assist", "등록번호", "성명", "성별", "나이", " 진단", "수술", "마취", "예상소요시간",
];

// 실제 스케줄과 같은 모양(제목 1행, 빈 2행, 헤더 3행, 날짜는 그날 첫 행에만)의 가상 데이터
async function workbook(rows: unknown[][], opts: { wide?: boolean } = {}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("7월7주");
  ws.getCell("K1").value = "★ ENT 수술 스케줄 ★";
  ws.getRow(3).values = HEADER;
  rows.forEach((r, i) => (ws.getRow(4 + i).values = r as ExcelJS.CellValue[]));
  if (opts.wide) ws.getCell("XFD54").value = " ";
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const row = (date: unknown, surgeon: string, procedure: string, extra: Partial<Record<string, string>> = {}) => [
  date, "", "Room23", "1", surgeon, "R2D", extra.chartNo ?? "900000001", extra.name ?? "테스트", "M", "41Y", "CRS[B]",
  procedure, "전신", "02 : 30", extra.note ?? "",
];

describe("parseScheduleWorkbook", () => {
  it("교수님이 같은 행만, 날짜는 아래로 채워서", async () => {
    const data = await workbook([
      row("2026-10-12", "다른교수", "T&A"),
      row(null, "정일구", "ESS[B]", { chartNo: "900000002" }),
      row("2026-10-16", "다른교수", "ESS[B]"),
      row(null, "정일구", "Septoplasty ; ESS[B]", { chartNo: "900000003", note: "당일" }),
    ]);
    const rows = await parseScheduleWorkbook(data, "정일구");
    expect(rows.map((r) => [r.date, r.chartNo, r.procedure])).toEqual([
      ["2026-10-12", "900000002", "ESS[B]"],
      ["2026-10-16", "900000003", "Septoplasty ; ESS[B]"],
    ]);
    expect(rows[1]).toMatchObject({
      room: "Room23", order: "1", assist: "R2D", sex: "M", age: "41Y", diagnosis: "CRS[B]",
      anesthesia: "전신", duration: "02 : 30", note: "당일",
    });
  });

  it("이름 앞뒤 공백은 무시한다", async () => {
    const data = await workbook([row("2026-10-12", "정일구 ", "ESS[B]")]);
    expect(await parseScheduleWorkbook(data, " 정일구")).toHaveLength(1);
  });

  it("다른 교수님 행은 결과에 전혀 없다", async () => {
    const data = await workbook([row("2026-10-12", "다른교수", "ESS[B]", { name: "비밀환자" })]);
    const rows = await parseScheduleWorkbook(data, "정일구");
    expect(JSON.stringify(rows)).not.toContain("비밀환자");
  });

  it("Date 셀도 YYYY-MM-DD로 읽는다", async () => {
    const data = await workbook([row(new Date(Date.UTC(2026, 9, 14)), "정일구", "ESS[B]")]);
    expect((await parseScheduleWorkbook(data, "정일구"))[0].date).toBe("2026-10-14");
  });

  it("날짜가 나오기 전 행은 버린다", async () => {
    const data = await workbook([row(null, "정일구", "ESS[B]"), row("2026-10-13", "정일구", "ESS[L]")]);
    expect((await parseScheduleWorkbook(data, "정일구")).map((r) => r.date)).toEqual(["2026-10-13"]);
  });

  it("범위가 XFD까지 넓은 시트도 빨리 읽는다", async () => {
    const data = await workbook([row("2026-10-16", "정일구", "ESS[B]")], { wide: true });
    const t = Date.now();
    expect(await parseScheduleWorkbook(data, "정일구")).toHaveLength(1);
    expect(Date.now() - t).toBeLessThan(2000);
  });

  it("헤더가 없으면 ScheduleFormatError", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("x").getCell("A1").value = "hello";
    const data = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(parseScheduleWorkbook(data, "정일구")).rejects.toBeInstanceOf(ScheduleFormatError);
  });

  it("xlsx가 아니면 ScheduleFormatError", async () => {
    const data = new TextEncoder().encode("not excel").buffer as ArrayBuffer;
    await expect(parseScheduleWorkbook(data, "정일구")).rejects.toBeInstanceOf(ScheduleFormatError);
  });
});
