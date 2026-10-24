import * as z from "zod";

// 처방 묶음(약물치료) — 진료실 프로그램이 오더 표에 바로 넣는다. 약은 병원 약품 목록에서 지금 처방 가능한 것만(2026-10-24 조회),
// 소아 용량 규칙은 병원 KIMS 허가 용법·용량 기준(emr-fill\kims_dosage.md). 숫자는 초안 — 의사가 확인·수정해 쓴다.
// 용법 코드(EMR): P1 1일 1회 아침, P3 1일 1회 저녁, P13 1일 2회, P123 1일 3회, M7 아침 7시. 스프레이는 비워 두면 EMR 기본값.

const AgeBand = z.object({ fromMonths: z.number().min(0), toMonths: z.number().nullable(), dose: z.string(), freq: z.string() });
const WeightBand = z.object({ fromKg: z.number().min(0), toKg: z.number().nullable(), dose: z.string(), freq: z.string() });
export const PedRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("age"), bands: z.array(AgeBand).min(1) }),
  z.object({ type: z.literal("weight"), bands: z.array(WeightBand).min(1) }),
  z.object({
    type: z.literal("kg"),
    mgPerKgDay: z.number().positive(),
    timesPerDay: z.number().int().min(1).max(4),
    freq: z.string(),
    mgPerUnit: z.number().positive(), // ml·g 1단위에 든 약 mg
    maxMgDay: z.number().positive().nullable().default(null),
    maxKg: z.number().positive().nullable().default(null), // 이 체중 이상은 쓰지 않음(허가 범위 밖)
  }),
  z.object({ type: z.literal("fixed") }), // 스프레이 등 — 나이 제한만 보고 그대로
]);
export type PedRule = z.infer<typeof PedRuleSchema>;

export const RxItemSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().max(120),
  dose: z.string().max(20).default(""),
  freq: z.string().max(20).default(""),
  days: z.string().max(5).default(""),
  minMonths: z.number().min(0).nullable().default(null), // 이 나이 미만은 쓰지 않음
  note: z.string().max(200).default(""),
  ped: PedRuleSchema.nullable().default(null),
});
export type RxItem = z.infer<typeof RxItemSchema>;

export const RxBundleInputSchema = z.object({
  title: z.string().trim().min(1).max(60),
  audience: z.enum(["adult", "child"]),
  sortOrder: z.coerce.number().int().min(0).max(999),
  items: z.array(RxItemSchema).min(1).max(15),
});
export type RxBundleInput = z.infer<typeof RxBundleInputSchema>;

export function parseRxItems(value: unknown): RxItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const p = RxItemSchema.safeParse(v);
    return p.success ? [p.data] : [];
  });
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export type CalcResult = { code: string; name: string; dose: string; freq: string; days: string; use: boolean; why: string };

// 소아 계산: 나이(개월)·몸무게(kg) → 1회량·용법. 범위 밖이면 use=false와 이유
export function calcPedItem(item: RxItem, ageMonths: number, weightKg: number | null): CalcResult {
  const base = { code: item.code, name: item.name, days: item.days };
  if (item.minMonths != null && ageMonths < item.minMonths) return { ...base, dose: "", freq: "", use: false, why: `${item.minMonths}개월 미만은 사용 안 함` };
  const r = item.ped;
  if (!r || r.type === "fixed") return { ...base, dose: item.dose, freq: item.freq, use: true, why: item.note };
  if (r.type === "age") {
    const b = r.bands.find((x) => ageMonths >= x.fromMonths && (x.toMonths == null || ageMonths < x.toMonths));
    return b ? { ...base, dose: b.dose, freq: b.freq, use: true, why: item.note } : { ...base, dose: "", freq: "", use: false, why: "이 나이 허가 용량 없음" };
  }
  if (weightKg == null || !(weightKg > 0)) return { ...base, dose: "", freq: "", use: false, why: "몸무게 필요" };
  if (r.type === "weight") {
    const b = r.bands.find((x) => weightKg >= x.fromKg && (x.toKg == null || weightKg < x.toKg));
    return b ? { ...base, dose: b.dose, freq: b.freq, use: true, why: item.note } : { ...base, dose: "", freq: "", use: false, why: "이 체중 허가 용량 없음" };
  }
  if (r.maxKg != null && weightKg >= r.maxKg) return { ...base, dose: "", freq: "", use: false, why: `${r.maxKg}kg 이상은 사용 경험 없음` };
  let mgDay = r.mgPerKgDay * weightKg;
  let capped = "";
  if (r.maxMgDay != null && mgDay > r.maxMgDay) { mgDay = r.maxMgDay; capped = ` (1일 최대 ${r.maxMgDay}mg로 제한)`; }
  const dose = round1(mgDay / r.timesPerDay / r.mgPerUnit);
  return { ...base, dose: String(dose), freq: r.freq, use: true, why: `${r.mgPerKgDay}mg/kg/일 ÷ ${r.timesPerDay}회${capped}${item.note ? ` · ${item.note}` : ""}` };
}

const item = (v: Partial<RxItem> & { code: string; name: string }): RxItem => RxItemSchema.parse(v);

// 성인 초안 — 병원 약(2026-10-24 외래 처방 가능)으로. 근거: ARIA–EAACI 2024–2025(비강 병합 우선), EPOS 2020
export const DEFAULT_ADULT_RX: RxBundleInput[] = [
  { title: "AR 기본(복합 스프레이)", audience: "adult", sortOrder: 10, items: [item({ code: "FTAZ_NSP", name: "DYLASTINE 비강 스프레이" })] },
  { title: "AR + 경구 항히스타민", audience: "adult", sortOrder: 20, items: [
    item({ code: "FTAZ_NSP", name: "DYLASTINE 비강 스프레이" }),
    item({ code: "BPT", name: "TWOLION 10mg", dose: "1", freq: "P13", days: "14" }),
  ] },
  { title: "AR + 천식(몬테루카스트)", audience: "adult", sortOrder: 30, items: [
    item({ code: "FTAZ_NSP", name: "DYLASTINE 비강 스프레이" }),
    item({ code: "MTLK10", name: "MONTEZAL 10mg", dose: "1", freq: "P3", days: "14" }),
  ] },
  { title: "콧물 위주(항콜린 스프레이)", audience: "adult", sortOrder: 40, items: [item({ code: "IPR_NSP", name: "RHINOVENT 비강 스프레이" })] },
  { title: "CRS 기본(스테로이드 스프레이)", audience: "adult", sortOrder: 50, items: [item({ code: "FTC_NSP", name: "AVAMYS 비강 스프레이", note: "식염수 세척은 병원 외 구매 안내" })] },
  { title: "CRS 악화(경구 스테로이드 단기)", audience: "adult", sortOrder: 60, items: [
    item({ code: "PRS", name: "SOLONDO 5mg", dose: "1", freq: "M7", days: "14", note: "기존 'CRS, Polyp 관련' 세트 용법" }),
    item({ code: "LFT", name: "STOGAR 10mg", dose: "1", freq: "P13", days: "14" }),
  ] },
  { title: "CRSsNP 장기 마크롤라이드", audience: "adult", sortOrder: 70, items: [item({ code: "CLR250", name: "KLARICID 250mg", dose: "1", freq: "P1", days: "28" })] },
  { title: "급성 세균성 부비동염", audience: "adult", sortOrder: 80, items: [item({ code: "AMCL625", name: "MAXICLAN 625mg", dose: "1", freq: "P123", days: "7" })] },
  { title: "후각저하 스테로이드(2주 감량)", audience: "adult", sortOrder: 90, items: [
    item({ code: "PRS", name: "SOLONDO 5mg (1주)", dose: "2", freq: "M7", days: "7", note: "기존 '후각 이상' 세트 용법" }),
    item({ code: "PRS", name: "SOLONDO 5mg (2주)", dose: "1", freq: "M7", days: "7" }),
    item({ code: "LFT", name: "STOGAR 10mg", dose: "1", freq: "P13", days: "14" }),
    item({ code: "FTC_NSP", name: "AVAMYS 비강 스프레이" }),
  ] },
];

// 소아 초안 — 병원 KIMS 허가 용법·용량. 그래뉼·건조시럽의 "mg" 단위가 약 성분 mg인지 확인 필요(1단위=1mg로 둠)
const L_TIRIZIN = item({ code: "LCT_SL", name: "L-TIRIZIN 0.5mg/ml", days: "14", minMonths: 12, ped: { type: "age", bands: [
  { fromMonths: 12, toMonths: 24, dose: "2.5", freq: "P3" },
  { fromMonths: 24, toMonths: 72, dose: "2.5", freq: "P13" },
  { fromMonths: 72, toMonths: null, dose: "10", freq: "P3" },
] } });
const AVAMYS_CHILD = item({ code: "FTC_NSP", name: "AVAMYS 비강 스프레이", minMonths: 24, note: "2~11세 양측 1번씩 1일 1회", ped: { type: "fixed" } });
const BIOFLOR = item({ code: "SCRM_P", name: "BIOFLOR 250mg", days: "7", ped: { type: "age", bands: [
  { fromMonths: 0, toMonths: 36, dose: "1", freq: "P13" },
  { fromMonths: 36, toMonths: 144, dose: "1", freq: "P123" },
  { fromMonths: 144, toMonths: null, dose: "1", freq: "P13" },
] } });
export const DEFAULT_CHILD_RX: RxBundleInput[] = [
  { title: "소아 AR", audience: "child", sortOrder: 10, items: [L_TIRIZIN, AVAMYS_CHILD] },
  { title: "소아 AR + 몬테루카스트", audience: "child", sortOrder: 20, items: [
    L_TIRIZIN,
    item({ code: "MTLK4_GR", name: "SINGULAIR 4mg 과립", days: "14", minMonths: 6, ped: { type: "age", bands: [{ fromMonths: 6, toMonths: 72, dose: "1", freq: "P3" }] } }),
    item({ code: "MTLK5", name: "MONTEZAL 5mg 츄정", days: "14", ped: { type: "age", bands: [{ fromMonths: 72, toMonths: 180, dose: "1", freq: "P3" }] } }),
  ] },
  { title: "소아 급성 부비동염(아목시실린·클라불란산)", audience: "child", sortOrder: 30, items: [
    item({ code: "AM120CL8.6_SR", name: "AMOXCLAN NEO 120mg/ml", days: "7", minMonths: 3, ped: { type: "kg", mgPerKgDay: 90, timesPerDay: 2, freq: "P13", mgPerUnit: 120, maxMgDay: null, maxKg: 40 } }),
    BIOFLOR,
  ] },
  { title: "소아 부비동염(세프디니르)", audience: "child", sortOrder: 40, items: [
    item({ code: "CFDN_GR", name: "OMNICEF 과립 100mg/g", days: "7", note: "KIMS 9~18mg/kg/일, 단위 확인 필요", ped: { type: "kg", mgPerKgDay: 14, timesPerDay: 3, freq: "P123", mgPerUnit: 1, maxMgDay: null, maxKg: null } }),
    BIOFLOR,
  ] },
  { title: "소아 마크롤라이드(클래리트로마이신)", audience: "child", sortOrder: 50, items: [
    item({ code: "CLR_DS", name: "CLARIC 25mg/ml", days: "7", ped: { type: "kg", mgPerKgDay: 15, timesPerDay: 2, freq: "P13", mgPerUnit: 25, maxMgDay: 1000, maxKg: null } }),
    BIOFLOR,
  ] },
  { title: "소아 기침·가래", audience: "child", sortOrder: 60, items: [
    item({ code: "IVCR_SR", name: "SYNATURA 시럽", days: "7", minMonths: 24, ped: { type: "age", bands: [
      { fromMonths: 24, toMonths: 84, dose: "5", freq: "P123" },
      { fromMonths: 84, toMonths: 180, dose: "10", freq: "P123" },
      { fromMonths: 180, toMonths: null, dose: "15", freq: "P123" },
    ] } }),
    item({ code: "EDS_DS", name: "ERDOLANT 3.5% (35mg/ml)", days: "7", ped: { type: "weight", bands: [
      { fromKg: 15, toKg: 20, dose: "5", freq: "P13" },
      { fromKg: 20, toKg: 30, dose: "5", freq: "P123" },
      { fromKg: 30, toKg: null, dose: "10", freq: "P13" },
    ] } }),
  ] },
];
