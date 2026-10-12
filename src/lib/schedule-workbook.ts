import ExcelJS from "exceljs";

export interface ScheduleRow {
  date: string;
  room: string;
  order: string;
  surgeon: string;
  assist: string;
  chartNo: string;
  name: string;
  sex: string;
  age: string;
  diagnosis: string;
  procedure: string;
  anesthesia: string;
  duration: string;
  note: string;
}

export class ScheduleFormatError extends Error {}

const COLUMNS: Record<Exclude<keyof ScheduleRow, "note">, string> = {
  date: "날짜",
  room: "Room",
  order: "순번",
  surgeon: "교수님",
  assist: "assist",
  chartNo: "등록번호",
  name: "성명",
  sex: "성별",
  age: "나이",
  diagnosis: "진단",
  procedure: "수술",
  anesthesia: "마취",
  duration: "예상소요시간",
};
const HEADER_SCAN_ROWS = 20;
const HEADER_SCAN_COLS = 40;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "richText" in value) return value.richText.map((r) => r.text).join("").trim();
  if (typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue);
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  return String(value).trim();
}

function toIsoDate(text: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}

// 주간 수술 스케줄 엑셀에서 surgeonName 교수님 행만 뽑는다. 시트 이름·헤더 위치는
// 주마다 다를 수 있어 헤더 텍스트로 열을 찾고, 날짜는 그날 첫 행에만 있어 아래로 채운다.
// 시트 범위가 XFD(16384열)까지 잡혀 있는 파일이 있어 찾은 열만 읽는다.
export async function parseScheduleWorkbook(data: ArrayBuffer, surgeonName: string): Promise<ScheduleRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    throw new ScheduleFormatError("엑셀(xlsx) 파일이 아닙니다.");
  }
  const target = surgeonName.trim();

  for (const ws of wb.worksheets) {
    let headerRow = 0;
    const col: Partial<Record<keyof ScheduleRow, number>> = {};
    for (let r = 1; r <= Math.min(HEADER_SCAN_ROWS, ws.rowCount) && !headerRow; r++) {
      const row = ws.getRow(r);
      const found: Partial<Record<keyof ScheduleRow, number>> = {};
      for (let c = 1; c <= HEADER_SCAN_COLS; c++) {
        const text = cellText(row.getCell(c).value);
        for (const [key, label] of Object.entries(COLUMNS)) if (text === label) found[key as keyof ScheduleRow] = c;
      }
      if (found.surgeon && found.procedure && found.date) {
        headerRow = r;
        Object.assign(col, found);
        // 헤더 없는 비고 칸(예: "당일 11:00-13:00")은 마지막 헤더 바로 오른쪽에 있다.
        col.note = Math.max(...Object.values(found)) + 1;
      }
    }
    if (!headerRow) continue;

    const rows: ScheduleRow[] = [];
    let currentDate: string | null = null;
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (key: keyof ScheduleRow) => {
        const c = col[key];
        return c ? cellText(row.getCell(c).value) : "";
      };
      currentDate = toIsoDate(get("date")) ?? currentDate;
      if (!currentDate || get("surgeon") !== target) continue;
      rows.push({
        date: currentDate,
        room: get("room"),
        order: get("order"),
        surgeon: get("surgeon"),
        assist: get("assist"),
        chartNo: get("chartNo"),
        name: get("name"),
        sex: get("sex"),
        age: get("age"),
        diagnosis: get("diagnosis"),
        procedure: get("procedure"),
        anesthesia: get("anesthesia"),
        duration: get("duration"),
        note: get("note"),
      });
    }
    return rows;
  }
  throw new ScheduleFormatError("수술 스케줄 형식(교수님·수술 칸)을 찾지 못했습니다.");
}
