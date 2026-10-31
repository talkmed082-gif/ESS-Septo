import * as z from "zod";

// 응급실에서 내가 본 환자 → 온콜대장(사용자 2026-10-31). 병원 PC = outpatient-list\er_sync.ps1 · er_oncall.ps1
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ErVisitItemSchema = z.object({
  chartNo: z.string().regex(/^\d{1,20}$/),
  patientName: z.string().max(50), // 가린 이름
  sexAge: z.string().max(30),
  arrivedAt: z.string().max(20), // "yyyy-MM-dd HH:mm"
  dept: z.string().max(30),
  complaint: z.string().max(300),
  resident: z.string().max(30), // 담당의
  dischargedAt: z.string().max(20),
  result: z.string().max(100),
  notes: z.string().max(500), // 내 기록지 "10:57 응급실경과기록, …"
  call: z.string().max(5),
  arrive: z.string().max(5),
  end: z.string().max(5),
});
export type ErVisitItem = z.infer<typeof ErVisitItemSchema>;

export const ErVisitBodySchema = z.object({
  date: ymd,
  items: z.array(ErVisitItemSchema).max(100),
  requestedAt: z.iso.datetime().optional(),
  // EMR 조회 실패 — 목록은 그대로 두고 요청만 비운다(10분마다 되풀이하지 않게)
  error: z.string().max(500).optional(),
});

export const ErOncallResultSchema = z.object({
  id: z.string().min(1).max(40),
  requestedAt: z.iso.datetime(),
  ok: z.boolean(),
  message: z.string().max(300).optional(),
});
export type ErOncallResult = z.infer<typeof ErOncallResultSchema>;

export function isYmd(s: string) {
  return ymd.safeParse(s).success;
}

function prevDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// 그날 응급실 환자의 담당의로 볼 이비인후과 당직자 — 그날 당직(일직·숙직) 모두 + 전날 숙직(아침까지 이어짐). 나는 뺀다
export function erDutyNames(rows: { date: string; name: string; kind: string }[], date: string, myName: string): string[] {
  const before = prevDay(date);
  const names = rows
    .filter((r) => r.date === date || (r.date === before && r.kind.includes("숙직")))
    .map((r) => r.name)
    .filter((n) => n !== myName);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "ko"));
}

// 온콜대장 시각 확인: HH:mm, 호출 ≤ 도착 ≤ 종료(온콜대장 화면도 순서가 틀리면 저장을 막는다)
export function checkOncallTimes(t: { call: string; arrive: string; end: string }): { error: string } | null {
  for (const [label, v] of [["호출", t.call], ["도착", t.arrive], ["종료", t.end]] as const) {
    if (!hhmm.test(v)) return { error: `${label} 시각을 HH:mm으로 넣어 주세요.` };
  }
  if (t.arrive < t.call) return { error: "도착 시각이 호출 시각보다 빠릅니다." };
  if (t.end < t.arrive) return { error: "종료 시각이 도착 시각보다 빠릅니다." };
  return null;
}
