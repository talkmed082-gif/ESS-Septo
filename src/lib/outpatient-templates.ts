import * as z from "zod";

// 외래 템플릿 — 진료실 PC 프로그램이 EMR 외래초진/경과 기록지 칸에 그대로 채운다.
// 칸 이름은 EMR 기록지 탭과 같다(초진: CC·PI·ROS·PE·Assessment·Plan, 경과: S·O·A·P).
export const TEMPLATE_KINDS = { symptom: "증상", diagnosis: "진단 받고 옴", exam: "검사" } as const;
export type TemplateKind = keyof typeof TEMPLATE_KINDS;
// 대상 — 프로그램에서 Ctrl+Shift+A(성인)/P(소아)로 바꾸고, 단축 번호(1~9)는 대상별로 따로
export const AUDIENCES = { adult: "성인", child: "소아" } as const;
export type Audience = keyof typeof AUDIENCES;

export const FIRST_FIELDS = [
  ["firstCc", "CC"],
  ["firstPi", "Present Illness"],
  ["firstRos", "ROS"],
  ["firstPe", "PE"],
  ["firstAssessment", "Assessment"],
  ["firstPlan", "Plan"],
] as const;

export const FOLLOW_FIELDS = [
  ["followSubjective", "Subjective"],
  ["followObjective", "Objective"],
  ["followAssessment", "Assessment"],
  ["followPlan", "Plan"],
] as const;

type FieldKey = (typeof FIRST_FIELDS)[number][0] | (typeof FOLLOW_FIELDS)[number][0];

// 템플릿에 연결한 약속처방 — EMR 약속처방 트리의 노드 키(사번별로 키가 겹칠 수 있어 사번도 같이)
export const SetOrderRefSchema = z.object({
  ownerEmpNo: z.string().trim().min(1).max(20),
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().max(200),
});
export type SetOrderRef = z.infer<typeof SetOrderRefSchema>;

const fieldText = z.string().max(4000);
export const TemplateInputSchema = z.object({
  title: z.string().trim().min(1).max(60),
  kind: z.enum(["symptom", "diagnosis", "exam"]),
  audience: z.enum(["adult", "child"]),
  shortcut: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(9).nullable()),
  sortOrder: z.coerce.number().int().min(0).max(999),
  ...(Object.fromEntries([...FIRST_FIELDS, ...FOLLOW_FIELDS].map(([k]) => [k, fieldText])) as Record<
    FieldKey,
    typeof fieldText
  >),
  setOrders: z.array(SetOrderRefSchema).max(30),
});
export type TemplateInput = z.infer<typeof TemplateInputSchema>;

// DB에 저장된 setOrders(Json)를 읽는다 — 형식이 깨진 항목은 버린다
export function parseSetOrderRefs(value: unknown): SetOrderRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const p = SetOrderRefSchema.safeParse(v);
    return p.success ? [p.data] : [];
  });
}

// 진료실 PC가 올리는 약속처방 목록 한 줄(트리 노드). lines는 세트 안 처방 줄(있을 때만)
export const SetOrderLineSchema = z.record(z.string(), z.string().max(500));
export const EmrSetOrderItemSchema = z.object({
  key: z.string().trim().min(1).max(100),
  path: z.string().max(500),
  name: z.string().trim().min(1).max(200),
  level: z.number().int().min(0).max(10),
  lines: z.array(SetOrderLineSchema).max(200).optional(),
});
export const EmrSetOrderBodySchema = z.object({
  ownerEmpNo: z.string().trim().regex(/^\d{4,12}$/),
  ownerName: z.string().trim().max(40).default(""),
  items: z.array(EmrSetOrderItemSchema).max(5000),
});
export type EmrSetOrderBody = z.infer<typeof EmrSetOrderBodySchema>;

const empty = Object.fromEntries([...FIRST_FIELDS, ...FOLLOW_FIELDS].map(([k]) => [k, ""])) as Record<FieldKey, string>;
type Draft = Omit<TemplateInput, "setOrders" | "audience" | "shortcut">;

// 처음 쓸 때 만드는 기본 템플릿 초안(사용자가 고쳐 쓴다). 빈칸은 진료 중 채울 자리.
// CC는 EMR 초진 화면 아래 CC 목록의 이름과 같아야 프로그램이 골라 준다(목록에 없으면 비워 둠 → 직접 고름).
// "비인강경"(검사)은 이름으로 찾는다 — 프로그램이 초진 PE/경과 Objective에 덧붙이고, 비어 있으면 재진 S·P(초진 Plan)도 채운다
// (재진은 S·P가 비면 오더를 낼 수 없음, 사용자 2026-10-24). 단축 번호는 순서대로 1~9.
const ADULT: Draft[] = [
  {
    ...empty, title: "코골이/수면무호흡", kind: "symptom", sortOrder: 10,
    firstCc: "snoring",
    firstPi: "onset:\n코골이 빈도:\n수면 중 무호흡 목격:\n주간 졸림(ESS):\n아침 두통/입마름:\n체중 변화:\n이전 PSG/CPAP:",
    firstRos: "nasal obstruction ( )\nrhinorrhea ( )",
    firstPe: "nasal cavity: septum / turbinate\noral cavity: tonsil grade ( ), Friedman tongue position ( )\nBMI:",
    firstAssessment: "r/o OSA", firstPlan: "PSG\nf/u after PSG",
    followSubjective: "코골이/무호흡 변화:\n주간 졸림:\nCPAP 사용(시간, 순응도):", followObjective: "PSG: AHI / min SaO2", followAssessment: "OSA",
  },
  {
    ...empty, title: "콧물", kind: "symptom", sortOrder: 20,
    firstCc: "rhinorrhea",
    firstPi: "onset:\n양상: watery / mucoid / purulent\n전방/후비루:\n양측/편측:\n악화 요인(계절, 찬공기):\n이전 치료:",
    firstRos: "nasal obstruction ( )\nsneezing ( )\nhyposmia ( )", firstPe: "nasal cavity: discharge / turbinate / septum",
    followSubjective: "콧물 변화:\n약 복용 반응:", followObjective: "nasal cavity: discharge / turbinate",
  },
  {
    ...empty, title: "코막힘", kind: "symptom", sortOrder: 30,
    firstCc: "obstruction, nose",
    firstPi: "onset:\n양측/편측(교대 여부):\n지속/간헐:\n수면 중 입벌림:\n외상력:\n비강 스프레이 사용(종류, 기간):\n이전 치료/수술:",
    firstRos: "rhinorrhea ( )\nsneezing ( )\nhyposmia ( )\nsnoring ( )", firstPe: "nasal cavity: septum / turbinate / polyp\nexternal nose:",
    followSubjective: "코막힘 변화:\n약/스프레이 사용:", followObjective: "nasal cavity: septum / turbinate",
  },
  {
    ...empty, title: "두통/안면통", kind: "symptom", sortOrder: 40,
    firstPi: "onset:\n부위:\n양상/강도:\n지속 시간/빈도:\n코 증상 동반(코막힘, 농성 콧물, 후각저하):\n악화 요인:\n진통제/이전 치료:",
    firstRos: "nasal obstruction ( )\npurulent rhinorrhea ( )\nhyposmia ( )", firstPe: "nasal cavity: middle meatus discharge / septum / turbinate",
    followSubjective: "두통/안면통 변화:\n약 복용 반응:", followObjective: "nasal cavity: middle meatus",
  },
  {
    ...empty, title: "재채기/알레르기", kind: "symptom", sortOrder: 50,
    firstCc: "sneezing",
    firstPi: "onset:\n계절성/통년성:\n가려움(코, 눈):\n유발 요인(먼지, 동물, 꽃가루):\n알레르기 검사 여부:\n이전 치료(항히스타민, 스프레이):",
    firstRos: "rhinorrhea ( )\nnasal obstruction ( )\nitching ( )", firstPe: "nasal cavity: pale turbinate / watery discharge / septum",
    firstAssessment: "r/o AR", firstPlan: "MAST",
    followSubjective: "재채기·콧물 변화:\n약 복용 반응:", followObjective: "nasal cavity: turbinate / discharge",
  },
  {
    ...empty, title: "인후두 이물감", kind: "symptom", sortOrder: 60,
    firstCc: "foreign body sense",
    firstPi: "onset:\n위치:\n삼킴 곤란/통증:\n쉰목소리:\n위산 역류 증상(가슴쓰림, 신물):\n흡연/음주:\n체중 감소:",
    firstRos: "dysphagia ( )\nhoarseness ( )\nheartburn ( )", firstPe: "oral cavity / oropharynx:\nlaryngoscopy:",
    followSubjective: "이물감 변화:\n역류 증상:\n약 복용 반응:", followObjective: "laryngoscopy:",
  },
  {
    ...empty, title: "무후각증", kind: "symptom", sortOrder: 70,
    firstCc: "anosmia",
    firstPi: "onset:\n갑자기/서서히:\n선행 감기/코로나:\n두부 외상:\n동반 코 증상(코막힘, 콧물):\n미각 변화:\n이전 치료(스테로이드):",
    firstRos: "nasal obstruction ( )\nrhinorrhea ( )\nheadache ( )", firstPe: "nasal cavity: olfactory cleft / polyp / septum",
    firstPlan: "olfactory test",
    followSubjective: "후각 변화:\n치료 반응(스테로이드, 후각훈련):", followObjective: "nasal cavity: olfactory cleft",
  },
  {
    ...empty, title: "부비동염(진단 후 의뢰)", kind: "diagnosis", sortOrder: 110,
    firstPi: "의뢰 병원/진단 시점:\n외부 영상(CT) 소견:\n증상(코막힘, 농성 콧물, 후각저하, 안면통):\n기간:\n이전 약물치료(항생제, 스테로이드, 기간):\n이전 수술:",
    firstPe: "nasal cavity: middle meatus / polyp / discharge / septum",
    followSubjective: "코막힘·농성 콧물·후각 변화:\n약 복용 반응:", followObjective: "nasal cavity: middle meatus / polyp / discharge",
  },
  {
    ...empty, title: "종물(진단 후 의뢰)", kind: "diagnosis", sortOrder: 120,
    firstCc: "mass",
    firstPi: "의뢰 병원/진단 시점:\n위치:\n외부 영상/조직검사 결과:\n증상(코피, 편측 코막힘, 통증, 시력/복시):\n기간:\n흡연:",
    firstRos: "epistaxis ( )\nunilateral obstruction ( )", firstPe: "nasal cavity / nasopharynx:\nneck:",
    followSubjective: "증상 변화:", followObjective: "nasal cavity / nasopharynx:\nneck:",
  },
  {
    ...empty, title: "비인강경", kind: "exam", sortOrder: 200,
    firstPe: "<비강 소견>", firstPlan: "비인강경검사",
    followSubjective: "f/u", followObjective: "<비강 소견>", followPlan: "비인강경검사",
  },
];

// 소아 초안(소아이비인후클리닉) — 보호자 진술 위주
const CHILD: Draft[] = [
  {
    ...empty, title: "코골이·입벌림(소아)", kind: "symptom", sortOrder: 10,
    firstCc: "snoring",
    firstPi: "onset:\n코골이 빈도:\n수면 중 무호흡 목격(보호자):\n입벌림/구강호흡:\n수면 중 뒤척임·야뇨:\n주간 졸림·집중력:\n잦은 편도염:",
    firstRos: "nasal obstruction ( )\nrhinorrhea ( )", firstPe: "tonsil grade ( )\nadenoid:\nnasal cavity:",
    firstAssessment: "r/o adenotonsillar hypertrophy", firstPlan: "adenoid X-ray / PSG",
    followSubjective: "코골이·입벌림 변화:\n수면 상태:", followObjective: "tonsil grade ( )",
  },
  {
    ...empty, title: "콧물·코막힘(소아)", kind: "symptom", sortOrder: 20,
    firstCc: "rhinorrhea",
    firstPi: "onset:\n양상: watery / mucoid / purulent\n코막힘:\n기침/후비루:\n어린이집·형제 감기:\n이전 치료(항생제):",
    firstRos: "cough ( )\nfever ( )\nnasal obstruction ( )", firstPe: "nasal cavity: discharge / turbinate\nTM:",
    followSubjective: "콧물·코막힘 변화:\n약 복용 반응:", followObjective: "nasal cavity: discharge",
  },
  {
    ...empty, title: "중이염·귀 통증(소아)", kind: "symptom", sortOrder: 30,
    firstCc: "pain, ear",
    firstPi: "onset:\n좌/우:\n발열:\n이루:\n최근 감기:\n중이염 반복(횟수):\n이전 치료(항생제, 기간):",
    firstRos: "fever ( )\notorrhea ( )\nrhinorrhea ( )", firstPe: "TM Rt:\nTM Lt:",
    followSubjective: "귀 통증·이루 변화:\n약 복용 반응:", followObjective: "TM Rt:\nTM Lt:",
  },
  {
    ...empty, title: "청력·검진 이상(소아)", kind: "symptom", sortOrder: 40,
    firstCc: "deafness",
    firstPi: "검진 결과(신생아 청각선별/학교 검진):\n보호자 관찰(불러도 반응 없음, TV 소리):\n언어 발달:\n중이염 병력:",
    firstPe: "TM Rt:\nTM Lt:", firstPlan: "PTA / impedance",
    followSubjective: "청력·언어 변화:", followObjective: "TM Rt:\nTM Lt:\nPTA / impedance:",
  },
  {
    ...empty, title: "재채기/알레르기(소아)", kind: "symptom", sortOrder: 50,
    firstCc: "sneezing",
    firstPi: "onset:\n계절성/통년성:\n가려움(코, 눈):\n아토피·천식:\n가족력:\n이전 치료:",
    firstRos: "rhinorrhea ( )\nnasal obstruction ( )", firstPe: "nasal cavity: pale turbinate / watery discharge",
    firstAssessment: "r/o AR", firstPlan: "MAST",
    followSubjective: "재채기·콧물 변화:\n약 복용 반응:", followObjective: "nasal cavity: turbinate",
  },
  {
    ...empty, title: "코피(소아)", kind: "symptom", sortOrder: 60,
    firstCc: "epistaxis",
    firstPi: "onset:\n빈도:\n좌/우:\n코 후비기:\n멍·잇몸 출혈:\n가족력(출혈 질환):",
    firstPe: "nasal cavity: Little's area / septum",
    followSubjective: "코피 빈도 변화:", followObjective: "nasal cavity: Little's area",
  },
];

export const DEFAULT_TEMPLATES: Omit<TemplateInput, "setOrders">[] = ADULT.map((t, i) => ({
  ...t,
  audience: "adult" as const,
  shortcut: t.kind === "exam" ? null : i + 1,
}));
export const DEFAULT_CHILD_TEMPLATES: Omit<TemplateInput, "setOrders">[] = CHILD.map((t, i) => ({
  ...t,
  audience: "child" as const,
  shortcut: i + 1,
}));