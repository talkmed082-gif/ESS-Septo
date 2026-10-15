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

// 병원 PC 작업 — 상태판에 보이는 순서. maxAgeHours: 이보다 오래 안 돌면 "늦음"(주말 포함 여유)
export const PC_JOBS = [
  { key: "SURGERY_DAILY", label: "수술 일정(평일 17:00)", maxAgeHours: 80 },
  { key: "SURGERY_WEEKLY", label: "다음 주 수술(금 17:05)", maxAgeHours: 7 * 24 + 6 },
  { key: "REMINDER_SYNC", label: "리마인더 정기 동기화(평일 17:10)", maxAgeHours: 80 },
  { key: "REMINDER_POLL", label: "요청 확인(평일 8:00~20:00, 10분마다)", maxAgeHours: 80 },
  { key: "OUTPATIENT", label: "외래 명단(월·목 17:20)", maxAgeHours: 4 * 24 + 6 },
  { key: "TSA_RANGE", label: "TSA 기간 확인(요청 시)", maxAgeHours: null },
  { key: "CRED_CHECK", label: "설정 파일 점검", maxAgeHours: null },
] as const;
export type PcJobKey = (typeof PC_JOBS)[number]["key"];

export const PcJobBodySchema = z.object({
  job: z.enum(PC_JOBS.map((j) => j.key) as [PcJobKey, ...PcJobKey[]]),
  ok: z.boolean(),
  message: z.string().max(500).optional(),
});

// 상태판 한 줄의 상태 — 실패 > 늦음 > 정상
export function pcJobState(
  status: { lastRunAt: Date; lastOk: boolean } | undefined,
  maxAgeHours: number | null,
  now: Date,
): "none" | "fail" | "late" | "ok" {
  if (!status) return "none";
  if (!status.lastOk) return "fail";
  if (maxAgeHours !== null && now.getTime() - status.lastRunAt.getTime() > maxAgeHours * 3600000) return "late";
  return "ok";
}

export const OutpatientListBodySchema = z.object({
  date: z.string().regex(DATE),
  clinic: z.string().max(50),
  rows: z.array(OutpatientRowSchema).max(300),
});
