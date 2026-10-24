import * as z from "zod";
import { parsePathwayLines } from "@/lib/pathways";

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
  soap: z.string().max(6000).optional(), // 병원 PC가 명단 뒤에 따로 올리는 AI SOAP(참고용)
  roadmap: z.string().max(4000).optional(), // 같은 AI 호출의 로드맵(경과·현재·할 일·확인) — SOAP는 오늘 진료, 로드맵은 긴 흐름
});
export type OutpatientRow = z.infer<typeof OutpatientRowSchema>;

// 병원 PC 작업 — 상태판에 보이는 순서. maxAgeHours: 이보다 오래 안 돌면 "늦음"(주말 포함 여유)
export const PC_JOBS = [
  { key: "SURGERY_DAILY", label: "수술 일정(평일 17:00)", maxAgeHours: 80 },
  { key: "SURGERY_WEEKLY", label: "다음 주 수술(금 17:05)", maxAgeHours: 7 * 24 + 6 },
  { key: "REMINDER_SYNC", label: "리마인더 정기 동기화(평일 17:10)", maxAgeHours: 80 },
  { key: "REMINDER_POLL", label: "요청 확인(평일 8:00~20:00, 10분마다)", maxAgeHours: 80 },
  { key: "OUTPATIENT", label: "외래 명단(월·목 17:20)", maxAgeHours: 4 * 24 + 6 },
  { key: "OUTPATIENT_SOAP", label: "외래 SOAP(외래 명단 뒤)", maxAgeHours: 4 * 24 + 6 },
  { key: "OUTPATIENT_REFRESH", label: "외래 명단 새로 고침(평일 8:00, 7일)", maxAgeHours: 80 },
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

export const OutpatientSoapBodySchema = z.object({
  date: z.string().regex(DATE),
  items: z
    .array(
      z.object({
        chartNo: z.string().min(1).max(20),
        soap: z.string().max(6000),
        roadmap: z.string().max(4000).optional(),
      }),
    )
    .max(300),
});
export type OutpatientSoapItem = z.infer<typeof OutpatientSoapBodySchema>["items"][number];

// 명단을 다시 올릴 때(매일 아침 새로 고침) 이미 붙어 있던 SOAP·로드맵을 등록번호로 옮겨 붙인다
export function carryOverSoap(oldRows: OutpatientRow[], newRows: OutpatientRow[]) {
  const old = new Map(oldRows.filter((r) => r.soap || r.roadmap).map((r) => [r.chartNo, r]));
  return newRows.map((r) => {
    const o = old.get(r.chartNo);
    if (!o) return r;
    return {
      ...r,
      ...(!r.soap && o.soap ? { soap: o.soap } : {}),
      ...(!r.roadmap && o.roadmap ? { roadmap: o.roadmap } : {}),
    };
  });
}

// 등록번호(일부, 숫자 4자리 이상)로 외래 명단 이력 찾기 — 최근 날짜부터
export function searchOutpatientHistory(
  lists: { date: string; clinic: string; rows: OutpatientRow[] }[],
  query: string,
) {
  const q = query.replace(/\D/g, "");
  if (q.length < 4) return [];
  return lists
    .flatMap((l) => l.rows.filter((r) => r.chartNo.includes(q)).map((row) => ({ date: l.date, clinic: l.clinic, row })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// 등록번호가 같은 명단 행에 SOAP(+로드맵)를 붙인다(명단에 없는 등록번호는 버림). 로드맵이 안 온 항목은 있던 로드맵을 둔다
export function mergeOutpatientSoap(rows: OutpatientRow[], items: OutpatientSoapItem[]) {
  const byChart = new Map(items.map((i) => [i.chartNo, i]));
  let matched = 0;
  const merged = rows.map((r) => {
    const item = byChart.get(r.chartNo);
    if (!item) return r;
    matched++;
    // 명단 행에는 [경로]·[외래] 줄을 뺀 로드맵 글만(그 줄은 진료 경로로 따로 저장)
    return { ...r, soap: item.soap, ...(item.roadmap !== undefined ? { roadmap: parsePathwayLines(item.roadmap).rest } : {}) };
  });
  return { rows: merged, matched };
}

// 자동화 쉬는 날(출장 등) — 설정 화면에서 기간을 넣는다. 하루짜리는 from=to. 너무 긴 기간은 실수로 보고 막는다(최대 92일).
export const AutomationPauseSchema = z
  .object({
    from: z.string().regex(DATE),
    to: z.string().regex(DATE),
    note: z.string().trim().max(60).optional(),
  })
  .refine((p) => p.from <= p.to, { message: "끝 날짜가 시작 날짜보다 앞입니다." })
  .refine((p) => (Date.parse(p.to) - Date.parse(p.from)) / 86400000 <= 92, { message: "한 번에 92일까지만 넣을 수 있습니다." });

// 그 날짜(yyyy-MM-dd)가 쉬는 기간 안이면 그 기간을 돌려준다(없으면 undefined)
export function findPause<T extends { from: string; to: string }>(pauses: T[], date: string): T | undefined {
  return pauses.find((p) => p.from <= date && date <= p.to);
}

// YES 근무 변동(출장·휴가)에서 자동으로 넣은 쉬는 날의 메모 머리 — 동기화 때 이것만 바꾼다
export const YES_PAUSE_PREFIX = "[YES]";
