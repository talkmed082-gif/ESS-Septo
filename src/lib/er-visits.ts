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
  shift: z.enum(["일직", "숙직"]).optional(), // 당직일(그날 08:30~다음 날 08:30) 중 내 첫 기록지 시각: 08:30~22:00 일직, 그 밖 숙직(병원 PC가 정함)
  oncallSaved: z.boolean().optional(), // 온콜대장에 이미 같은 날·같은 환자 줄이 있음(직접 넣었거나 저장됨)
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

// 그날 응급실 환자의 담당의로 볼 이비인후과 당직자 — 그 당직일의 당직표(일직·숙직) 모두. 나는 뺀다
export function erDutyNames(rows: { date: string; name: string; kind: string }[], date: string, myName: string): string[] {
  const names = rows.filter((r) => r.date === date).map((r) => r.name).filter((n) => n !== myName);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "ko"));
}

// 그날 내 당직 종류로 온콜대장에 올릴 수 있는 근무: 휴일 일직·숙직이면 둘, 평일 숙직이면 숙직만(사용자 2026-10-31)
export function erMyShifts(rows: { date: string; name: string; kind: string }[], date: string, myName: string): ("일직" | "숙직")[] {
  const kinds = rows.filter((r) => r.date === date && r.name === myName).map((r) => r.kind);
  return (["일직", "숙직"] as const).filter((s) => kinds.some((k) => k.includes(s)));
}

// 숙직 시작 시각: 평일 숙직 17:30, 휴일(일직 다음) 22:00(사용자 2026-10-31). 병원 PC가 이 시각으로 일직·숙직을 가른다
export function erNightStart(rows: { date: string; name: string; kind: string }[], date: string, myName: string): string {
  return rows.some((r) => r.date === date && r.name === myName && r.kind.includes("평일")) ? "17:30" : "22:00";
}

// 온콜대장 신청 막기: 내 근무가 아니거나, 같은 근무에 이미 신청·저장한 환자가 있으면 이유. 괜찮으면 null
export function erOncallBlock(
  v: { id: string; shift: string | null },
  sameDay: { id: string; shift: string | null; oncallStatus: string | null }[],
  myShifts: string[],
): string | null {
  if (!v.shift || !myShifts.includes(v.shift)) return `내 ${v.shift ?? ""} 근무가 아니라 신청 대상이 아닙니다(당직표 기준).`;
  const taken = sameDay.find((o) => o.id !== v.id && o.shift === v.shift && (o.oncallStatus === "PENDING" || o.oncallStatus === "SAVED"));
  return taken ? `이 ${v.shift}은 이미 다른 환자로 신청했습니다(근무마다 한 명).` : null;
}

// 온콜대장 시각 확인: HH:mm, 호출 ≤ 도착 ≤ 종료(온콜대장 화면도 순서가 틀리면 저장을 막는다).
// 숙직 중 자정을 넘기면(23:50 호출 → 00:10 도착) 호출보다 이른 08:30 이전 시각은 다음 날로 본다 — 온콜대장 화면도 종료가 08:00 이전이면 넘김을 받는다
export function checkOncallTimes(t: { call: string; arrive: string; end: string }): { error: string } | null {
  for (const [label, v] of [["호출", t.call], ["도착", t.arrive], ["종료", t.end]] as const) {
    if (!hhmm.test(v)) return { error: `${label} 시각을 HH:mm으로 넣어 주세요.` };
  }
  const min = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const after = (v: string) => (v < t.call && v <= "08:30" ? min(v) + 1440 : min(v));
  if (after(t.arrive) < min(t.call)) return { error: "도착 시각이 호출 시각보다 빠릅니다." };
  if (after(t.end) < after(t.arrive)) return { error: "종료 시각이 도착 시각보다 빠릅니다." };
  return null;
}
