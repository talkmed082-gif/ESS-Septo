import * as z from "zod";

// 양압기 회사 — 외래 기록에 "CPAP (YT)"처럼 영어 두 글자로 적는다(사용자 2026-10-27). 결과(사용 데이터)를 받으려면 회사에 연락.
// tel: 담당자 문자(사용자 2026-10-27), email: 결과 메일을 보내는 주소(아직 받은 적 없는 회사는 null — 이름으로만 찾음)
export const CPAP_VENDORS: Record<string, { tel: string | null; email: string | null }> = {
  YT: { tel: "010-4600-0944", email: null },
  RM: { tel: "010-7548-1461", email: null },
  BG: { tel: "010-2794-6241", email: null },
  FP: { tel: "010-3562-0915", email: "busan@slmedicare.co.kr" },
};

// 회사에 보내는 문자(사용자 2026-10-27 문구 그대로). 폰에서 [문자]를 누르면 문구가 채워진 문자 창이 열리고 직접 전송
export const DOCTOR_EMAIL = "ilguuu@gmail.com";
export function cpapRxText(p: { name: string; sex: string; age: string; phone: string; ahi: string }): string {
  return `안녕하세요 양산부산대병원 이비인후과 정일구입니다. ${p.name}님 ${p.sex}/${p.age}, ${p.phone}, AHI ${p.ahi} 환자 의뢰드립니다.\n잘 부탁드립니다.`;
}
export function cpapResultText(p: { name: string; visitDate: string; today: string }): string {
  const when = p.visitDate === p.today ? "오늘" : `${Number(p.visitDate.slice(5, 7))}/${Number(p.visitDate.slice(8, 10))}`;
  return `안녕하세요. 양산부산대병원 비과전임의 정일구입니다. ${when} 외래 예정인 ${p.name} 환자분 양압기 결과 보내주실 수 있으실까요? 제 메일 주소는 ${DOCTOR_EMAIL} 입니다.`;
}
// 외래 후 처방 안내(사용자 2026-10-27 문구): "김차중님 3개월 추가 처방했습니다." / 압력을 바꾸면 "조외용님 압력 6-10으로 변경해서 3개월 추가 처방했습니다."
export function cpapNoticeText(p: { name: string; months: number; pressure: string | null }): string {
  return `${p.name}님 ${p.pressure ? `압력 ${p.pressure}으로 변경해서 ` : ""}${p.months}개월 추가 처방했습니다.`;
}
// "Pr 4-12" → "4-12"
export const pressureOf = (setting: string | null) => setting?.match(/(\d+)\s*-\s*(\d+)/)?.slice(1, 3).join("-") ?? "";
// iOS·안드로이드 모두 열리는 문자 주소
export const smsHref = (tel: string, body: string) => `sms:${tel.replace(/-/g, "")}?&body=${encodeURIComponent(body)}`;

// 결과 메일 찾기(Gmail 검색어) — 받은 적 있는 회사는 보낸 주소로, 아니면 이름 + 양압기/CPAP. 처방일(없으면 외래 60일 전) 뒤
export function cpapMailQuery(c: { vendor: string | null; realName: string | null; rxDate: string | null }, visitDate: string): string | null {
  if (!c.realName) return null;
  const from = c.vendor ? CPAP_VENDORS[c.vendor]?.email : null;
  const since = c.rxDate ?? new Date(Date.parse(`${visitDate}T00:00:00Z`) - 60 * 86_400_000).toISOString().slice(0, 10);
  return `${from ? `from:${from}` : "(양압기 OR CPAP)"} after:${since.replace(/-/g, "/")} "${c.realName}"`;
}

// 노트북이 6개월 외래 기록에서 규칙으로 찾은 것(AI 아님) — vendor: 가장 최근 "CPAP (두 글자)", setting: 그 줄의 "Pr 4-12" 등,
// rxDate·months: 가장 최근 양압기 처방 문장("양압기 석 달 처방", "처방전 3개월", "재처방 6달")의 진료 날짜와 개월 수
export const CpapSchema = z.object({
  vendor: z.string().regex(/^[A-Z]{2}$/).nullable().default(null),
  setting: z.string().max(80).nullable().default(null),
  rxDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  months: z.number().int().min(1).max(24).nullable().default(null),
  rxLine: z.string().max(200).nullable().default(null),
  // 회사 문자에 넣을 실명 — CPAP 환자만 노트북이 명단 파일에서 올림(사용자 2026-10-27 선택). 다른 환자 이름은 사이트에 가린 채
  realName: z.string().max(30).nullable().default(null),
  // 결과 메일 확인(OSA 시트 웹앱 → Gmail) — [메일 확인] 때 사이트가 채움
  mail: z.object({ checkedAt: z.string(), hits: z.array(z.object({ date: z.string(), subject: z.string() })).max(5) }).nullable().default(null),
  // PSG AHI — 노트북이 예전 기록의 "@ PSG … (AHI 45.0/hr)"에서 찾음. CPAP data 줄의 "AHI 45.0 (PSG) -> 잔여"에 씀
  psgAhi: z.string().max(10).nullable().default(null),
  // 회사가 보낸 결과(데이터 PDF → "@ CPAP data" 글, 보고서 hwp → 처방만료일) — 이 PC가 J:\내 드라이브\CPAP에서 읽어 올림(2026-10-27)
  report: z.object({ text: z.string().max(1500), expiry: z.string().max(20).nullable(), kind: z.string().max(40).nullable(), at: z.string() }).nullable().default(null),
});

// 노트북이 Objective에 넣을 글 — PSG AHI를 알면 "AHI 4.8" 줄을 "AHI 45.0 (PSG) -> 4.8"로
export function cpapObjectiveText(c: Pick<Cpap, "report" | "psgAhi">): string | null {
  if (!c.report?.text) return null;
  const t = c.psgAhi ? c.report.text.replace(/^AHI ([\d.]+)$/m, `AHI ${c.psgAhi} (PSG) -> $1`) : c.report.text;
  return c.report.expiry ? `${t}\n처방만료일 ${c.report.expiry}` : t;
}
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
