import * as z from "zod";

// "병원 연동" 화면과 병원 PC API가 같이 쓰는 순수 로직(날짜 계산·형식 검사).

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MAX_SCAN_DAYS = 92;

// 한국 시간 기준 날짜(yyyy-MM-dd). 서버(Vercel)는 UTC라 직접 맞춘다.
export function kstDate(now: Date, addDays = 0): string {
  return new Date(now.getTime() + KST_OFFSET_MS + addDays * 86400000).toISOString().slice(0, 10);
}

// TSA 기간 확인 범위 검사 — 미래 TSA는 신경외과만 넣어 뒀을 수 있어 끝 날짜는 내일까지만.
// 너무 긴 기간은 병원 PC가 EMR을 오래 붙잡으니 막는다.
export function validateTsaScanRange(from: string, to: string, now: Date): string | null {
  if (!DATE.test(from) || !DATE.test(to)) return "날짜를 골라 주세요.";
  if (from > to) return "시작 날짜가 끝 날짜보다 뒤입니다.";
  const tomorrow = kstDate(now, 1);
  if (to > tomorrow) return `끝 날짜는 내일(${tomorrow})까지만 고를 수 있습니다.`;
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (days > MAX_SCAN_DAYS) return `한 번에 ${MAX_SCAN_DAYS}일까지만 확인할 수 있습니다.`;
  return null;
}

const SheetRef = z.object({ date: z.string(), chart4: z.string(), rows: z.array(z.number()) });

// 병원 PC가 올리는 TSA 시트 실행 결과. requestedAt: 처리한 "기간 확인" 요청 시각(일일 실행이면 없음)
export const TsaRunBodySchema = z.object({
  kind: z.enum(["DAILY", "RANGE"]),
  from: z.string().regex(DATE),
  to: z.string().regex(DATE),
  found: z.number().int().min(0),
  added: z.number().int().min(0),
  skipped: z.number().int().min(0),
  held: z.array(SheetRef).max(200),
  dups: z.array(SheetRef).max(200),
  error: z.string().max(500).optional(),
  requestedAt: z.iso.datetime().optional(),
});
export type TsaRunBody = z.infer<typeof TsaRunBodySchema>;

export const OutpatientRowSchema = z.object({
  time: z.string().max(20),
  name: z.string().max(50),
  chartNo: z.string().max(20),
  visit: z.string().max(20),
  diagnosis: z.string().max(200),
});
export type OutpatientRow = z.infer<typeof OutpatientRowSchema>;

export const OutpatientListBodySchema = z.object({
  date: z.string().regex(DATE),
  clinic: z.string().max(50),
  rows: z.array(OutpatientRowSchema).max(300),
});
