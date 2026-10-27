import * as z from "zod";

// 양압기 회사 — 외래 기록에 "CPAP (YT)"처럼 영어 두 글자로 적는다(사용자 2026-10-27). 결과(사용 데이터)를 받으려면 회사에 연락.
// 연락처를 모르는 회사는 빈칸(사용자가 나중에 알려 줌)
export const CPAP_VENDORS: Record<string, { tel: string | null }> = {
  YT: { tel: "010-4600-0944" },
  RM: { tel: "010-7548-1461" },
  BG: { tel: null },
  FP: { tel: null },
};

// 노트북이 6개월 외래 기록에서 규칙으로 찾은 것(AI 아님) — vendor: 가장 최근 "CPAP (두 글자)", setting: 그 줄의 "Pr 4-12" 등,
// rxDate·months: 가장 최근 양압기 처방 문장("양압기 석 달 처방", "처방전 3개월", "재처방 6달")의 진료 날짜와 개월 수
export const CpapSchema = z.object({
  vendor: z.string().regex(/^[A-Z]{2}$/).nullable().default(null),
  setting: z.string().max(80).nullable().default(null),
  rxDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  months: z.number().int().min(1).max(24).nullable().default(null),
  rxLine: z.string().max(200).nullable().default(null),
});
export type Cpap = z.infer<typeof CpapSchema>;

export const CpapUploadSchema = z.object({
  items: z.array(z.object({ chartNo: z.string().trim().regex(/^\d{4,12}$/), cpap: CpapSchema })).max(300),
});

// 처방 기간이 끝나는 날(처방일 + 개월)
export function cpapDue(c: Pick<Cpap, "rxDate" | "months">): string | null {
  if (!c.rxDate || !c.months) return null;
  const [y, m, d] = c.rxDate.split("-").map(Number);
  const due = new Date(Date.UTC(y, m - 1 + c.months, d));
  return due.toISOString().slice(0, 10);
}

// CPAP F/U 환자 — 양압기를 몇 달 처방하고, 그 기간이 지나(2주 일찍 와도 포함) 실제로 외래에 오는 환자(사용자 2026-10-27)
export function isCpapFollowUp(c: Pick<Cpap, "rxDate" | "months">, visitDate: string): boolean {
  const due = cpapDue(c);
  if (!due || !c.rxDate || visitDate <= c.rxDate) return false;
  return Date.parse(`${visitDate}T00:00:00Z`) >= Date.parse(`${due}T00:00:00Z`) - 14 * 86_400_000;
}
