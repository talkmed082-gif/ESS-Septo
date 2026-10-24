import * as z from "zod";

// 외래 템플릿 — 진료실 PC 프로그램이 EMR 외래초진/경과 기록지 칸에 그대로 채운다.
// 칸 이름은 EMR 기록지 탭과 같다(초진: CC·PI·ROS·PE·Assessment·Plan, 경과: S·O·A·P).
export const TEMPLATE_KINDS = { symptom: "증상", diagnosis: "진단 받고 옴", exam: "검사" } as const;
export type TemplateKind = keyof typeof TEMPLATE_KINDS;
// 대상 — 프로그램이 환자 나이로 고르고(15세 미만 소아), 단축 번호(1~9)는 대상별로 따로
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
    ...empty, title: "코막힘(비중격·비갑개)", kind: "symptom", sortOrder: 10,
    firstCc: "obstruction, nose",
    firstPi: "onset:\n양측/편측(교대 여부):\n지속/간헐:\n수면 중 입벌림·코골이:\n외상력:\n비강 스프레이 사용(종류, 기간):\n이전 치료/수술:",
    firstRos: "rhinorrhea ( )\nsneezing ( )\nhyposmia ( )\nsnoring ( )", firstPe: "nasal cavity: septum deviation / turbinate hypertrophy / polyp\nexternal nose:",
    firstPlan: "약물치료 반응 후 수술(septoplasty, turbinoplasty) 고려",
    followSubjective: "코막힘 변화:\n약/스프레이 사용:", followObjective: "nasal cavity: septum / turbinate",
  },
  {
    ...empty, title: "만성 부비동염", kind: "symptom", sortOrder: 20,
    firstCc: "obstruction, nose",
    firstPi: "기간(12주 이상):\n코막힘:\n농성 콧물·후비루:\n후각저하:\n안면통·압박감:\n천식·아스피린 과민:\n이전 약물치료(항생제, 스테로이드, 기간):\n이전 수술:",
    firstRos: "postnasal drip ( )\nhyposmia ( )\nheadache ( )", firstPe: "nasal cavity: middle meatus / polyp / discharge / septum",
    firstAssessment: "CRS (s/w NP)", firstPlan: "PNS CT\n비강 스테로이드 + 세척\nf/u 4주",
    followSubjective: "코막힘·농성 콧물·후각 변화:\n약 복용 반응:", followObjective: "nasal cavity: middle meatus / polyp / discharge",
  },
  {
    ...empty, title: "알레르기 비염", kind: "symptom", sortOrder: 30,
    firstCc: "sneezing",
    firstPi: "onset:\n계절성/통년성:\n재채기·콧물·코막힘·가려움(코, 눈):\n유발 요인(먼지, 동물, 꽃가루):\n천식·아토피:\n알레르기 검사 여부:\n이전 치료(항히스타민, 스프레이):",
    firstRos: "rhinorrhea ( )\nnasal obstruction ( )\nitching ( )", firstPe: "nasal cavity: pale turbinate / watery discharge / septum",
    firstAssessment: "r/o AR", firstPlan: "MAST\n약물치료\nf/u 4주",
    followSubjective: "재채기·콧물·코막힘 변화:\n약 복용 반응:", followObjective: "nasal cavity: turbinate / discharge",
  },
  {
    ...empty, title: "후각저하", kind: "symptom", sortOrder: 40,
    firstCc: "anosmia",
    firstPi: "onset:\n갑자기/서서히:\n선행 감기·코로나:\n두부 외상:\n코막힘·콧물 동반:\n착후각·환후각:\n미각 변화:\n이전 치료(스테로이드):",
    firstRos: "nasal obstruction ( )\nrhinorrhea ( )\nheadache ( )", firstPe: "nasal cavity: olfactory cleft / polyp / septum",
    firstPlan: "후각검사(KVSS)\n후각 훈련 12주\nf/u 3개월",
    followSubjective: "후각 변화:\n후각 훈련 여부:\n치료 반응:", followObjective: "nasal cavity: olfactory cleft\n후각검사:",
  },
  {
    ...empty, title: "코피", kind: "symptom", sortOrder: 50,
    firstCc: "epistaxis",
    firstPi: "onset:\n빈도·양:\n좌/우:\n항응고·항혈소판제:\n고혈압:\n외상·코 후비기:\n지혈 경과:",
    firstPe: "nasal cavity: Little's area / bleeding focus / septum",
    followSubjective: "코피 재발 여부:", followObjective: "nasal cavity: Little's area",
  },
  {
    ...empty, title: "코골이·수면무호흡", kind: "symptom", sortOrder: 60,
    firstCc: "snoring",
    firstPi: "onset:\n코골이 빈도:\n수면 중 무호흡 목격:\n주간 졸림(ESS):\n아침 두통·입마름:\n체중 변화:\n이전 PSG·CPAP:",
    firstRos: "nasal obstruction ( )\nrhinorrhea ( )",
    firstPe: "nasal cavity: septum / turbinate\noral cavity: tonsil grade ( ), Friedman tongue position ( )\nBMI:",
    firstAssessment: "r/o OSA", firstPlan: "PSG\nf/u after PSG",
    followSubjective: "코골이·무호흡 변화:\n주간 졸림:\nCPAP 사용(시간, 순응도):", followObjective: "PSG: AHI / min SaO2", followAssessment: "OSA",
  },
  {
    ...empty, title: "비강·부비동 종물", kind: "symptom", sortOrder: 70,
    firstCc: "mass",
    firstPi: "onset:\n위치:\n편측 코막힘·코피·악취 콧물:\n통증·시력/복시:\n외부 영상·조직검사:\n흡연:",
    firstRos: "epistaxis ( )\nunilateral obstruction ( )", firstPe: "nasal cavity / nasopharynx:\nneck:",
    firstPlan: "biopsy\nCT/MRI",
    followSubjective: "증상 변화:", followObjective: "nasal cavity / nasopharynx:",
  },
  {
    ...empty, title: "수술 후 추적(ESS·비중격)", kind: "symptom", sortOrder: 80,
    firstPi: "수술일·수술명:\n수술 후 증상:\n세척·스프레이 사용:",
    firstPe: "nasal cavity: crust / synechia / middle meatus / septum",
    followSubjective: "수술 후 증상:\n세척·스프레이 사용:", followObjective: "nasal cavity: crust / synechia / middle meatus / septum",
    followPlan: "세척·비강 스테로이드 지속",
  },
  {
    ...empty, title: "인후두 이물감·후비루", kind: "symptom", sortOrder: 90,
    firstCc: "foreign body sense",
    firstPi: "onset:\n후비루:\n삼킴 곤란·통증:\n쉰목소리:\n역류 증상(가슴쓰림, 신물):\n흡연·음주:\n체중 감소:",
    firstRos: "dysphagia ( )\nhoarseness ( )\nheartburn ( )", firstPe: "nasal cavity: postnasal discharge\noropharynx:\nlaryngoscopy:",
    followSubjective: "이물감·후비루 변화:\n약 복용 반응:", followObjective: "laryngoscopy:",
  },
  // 번호 없는 버튼(진단 받고 옴)
  {
    ...empty, title: "부비동염(진단 후 의뢰)", kind: "diagnosis", sortOrder: 110,
    firstPi: "의뢰 병원·진단 시점:\n외부 영상(CT) 소견:\n증상(코막힘, 농성 콧물, 후각저하, 안면통):\n기간:\n이전 약물치료(항생제, 스테로이드, 기간):\n이전 수술:",
    firstPe: "nasal cavity: middle meatus / polyp / discharge / septum",
    followSubjective: "코막힘·농성 콧물·후각 변화:\n약 복용 반응:", followObjective: "nasal cavity: middle meatus / polyp / discharge",
  },
  {
    ...empty, title: "종물(진단 후 의뢰)", kind: "diagnosis", sortOrder: 120,
    firstCc: "mass",
    firstPi: "의뢰 병원·진단 시점:\n위치:\n외부 영상·조직검사 결과:\n증상(코피, 편측 코막힘, 통증, 시력/복시):\n기간:\n흡연:",
    firstPe: "nasal cavity / nasopharynx:\nneck:",
    followSubjective: "증상 변화:", followObjective: "nasal cavity / nasopharynx:",
  },
  {
    ...empty, title: "두통·안면통(진단 후 의뢰)", kind: "diagnosis", sortOrder: 130,
    firstPi: "의뢰 사유:\n부위·양상·빈도:\n코 증상 동반(코막힘, 농성 콧물, 후각저하):\n외부 영상:\n진통제·이전 치료:",
    firstPe: "nasal cavity: middle meatus / septum contact point",
    followSubjective: "두통·안면통 변화:", followObjective: "nasal cavity: middle meatus",
  },
  {
    ...empty, title: "비인강경", kind: "exam", sortOrder: 200,
    firstPe: "<비강 소견>", firstPlan: "비인강경검사",
    followSubjective: "f/u", followObjective: "<비강 소견>", followPlan: "비인강경검사",
  },
];

// 소아 초안(소아이비인후클리닉, 코 중심 — 귀는 다루지 않음, 사용자 2026-10-24) — 보호자 진술 위주
const CHILD: Draft[] = [
  {
    ...empty, title: "코골이·입벌림(소아)", kind: "symptom", sortOrder: 10,
    firstCc: "snoring",
    firstPi: "onset:\n코골이 빈도:\n수면 중 무호흡 목격(보호자):\n입벌림·구강호흡:\n수면 중 뒤척임·야뇨:\n주간 졸림·집중력:\n잦은 편도염:",
    firstRos: "nasal obstruction ( )\nrhinorrhea ( )", firstPe: "tonsil grade ( )\nadenoid:\nnasal cavity:",
    firstAssessment: "r/o adenotonsillar hypertrophy", firstPlan: "adenoid X-ray / PSG",
    followSubjective: "코골이·입벌림 변화:\n수면 상태:", followObjective: "tonsil grade ( )",
  },
  {
    ...empty, title: "콧물·코막힘(소아)", kind: "symptom", sortOrder: 20,
    firstCc: "rhinorrhea",
    firstPi: "onset:\n양상: watery / mucoid / purulent\n코막힘:\n기침·후비루:\n발열:\n어린이집·형제 감기:\n이전 치료(항생제):",
    firstRos: "cough ( )\nfever ( )\nnasal obstruction ( )", firstPe: "nasal cavity: discharge / turbinate",
    followSubjective: "콧물·코막힘 변화:\n약 복용 반응:", followObjective: "nasal cavity: discharge",
  },
  {
    ...empty, title: "알레르기 비염(소아)", kind: "symptom", sortOrder: 30,
    firstCc: "sneezing",
    firstPi: "onset:\n계절성/통년성:\n재채기·콧물·코막힘·가려움(코, 눈):\n아토피·천식:\n가족력:\n이전 치료:",
    firstRos: "rhinorrhea ( )\nnasal obstruction ( )", firstPe: "nasal cavity: pale turbinate / watery discharge",
    firstAssessment: "r/o AR", firstPlan: "MAST",
    followSubjective: "재채기·콧물 변화:\n약 복용 반응:", followObjective: "nasal cavity: turbinate",
  },
  {
    ...empty, title: "부비동염(소아)", kind: "symptom", sortOrder: 40,
    firstCc: "rhinorrhea",
    firstPi: "기간(10일 이상 지속·악화 여부):\n농성 콧물·후비루:\n기침(밤):\n발열:\n안면통·두통:\n이전 항생제(종류, 기간):",
    firstRos: "cough ( )\nfever ( )\nheadache ( )", firstPe: "nasal cavity: purulent discharge / middle meatus\noropharynx: postnasal discharge",
    firstAssessment: "r/o acute rhinosinusitis",
    followSubjective: "농성 콧물·기침 변화:\n약 복용 반응:", followObjective: "nasal cavity: discharge",
  },
  {
    ...empty, title: "코피(소아)", kind: "symptom", sortOrder: 50,
    firstCc: "epistaxis",
    firstPi: "onset:\n빈도:\n좌/우:\n코 후비기:\n멍·잇몸 출혈:\n가족력(출혈 질환):",
    firstPe: "nasal cavity: Little's area / septum",
    followSubjective: "코피 빈도 변화:", followObjective: "nasal cavity: Little's area",
  },
  {
    ...empty, title: "코 이물(소아)", kind: "symptom", sortOrder: 60,
    firstCc: "foreign body, nose",
    firstPi: "넣은 시점·물건(보호자 진술):\n좌/우:\n편측 악취 콧물·코피:\n이전 제거 시도:",
    firstPe: "nasal cavity: foreign body / discharge",
    firstPlan: "foreign body removal",
    followSubjective: "증상 변화:", followObjective: "nasal cavity:",
  },
  {
    ...empty, title: "코 외상(소아)", kind: "symptom", sortOrder: 70,
    firstCc: "injury, face",
    firstPi: "다친 시점·경위:\n코피:\n코 모양 변형:\n코막힘:\n의식 소실·다른 부위 손상:",
    firstPe: "external nose: deformity / swelling / tenderness\nnasal cavity: septal hematoma 여부",
    firstPlan: "nasal bone X-ray / CT",
    followSubjective: "코막힘·변형 변화:", followObjective: "external nose:\nnasal cavity:",
  },
  {
    ...empty, title: "편도염·목 통증(소아)", kind: "symptom", sortOrder: 80,
    firstCc: "sore throat",
    firstPi: "onset:\n발열:\n편도염 횟수(최근 1년·2년·3년):\n삼킴 곤란:\n코골이:\n이전 항생제:",
    firstRos: "fever ( )\ndysphagia ( )", firstPe: "tonsil grade ( ) / exudate\nneck LN:",
    followSubjective: "목 통증·발열 변화:", followObjective: "tonsil:",
  },
  {
    ...empty, title: "설소대·발음(소아)", kind: "symptom", sortOrder: 90,
    firstCc: "tongue tie",
    firstPi: "보호자 걱정(수유·발음):\n발음 문제 음소:\n언어 발달:",
    firstPe: "lingual frenulum: ankyloglossia grade\ntongue protrusion:",
    followSubjective: "발음 변화:", followObjective: "lingual frenulum:",
  },
];
export const DEFAULT_TEMPLATES: Omit<TemplateInput, "setOrders">[] = ADULT.map((t, i) => ({
  ...t,
  audience: "adult" as const,
  shortcut: t.kind === "symptom" && i < 9 ? i + 1 : null, // 증상 9개만 번호, 진단 의뢰·검사는 버튼으로만
}));
export const DEFAULT_CHILD_TEMPLATES: Omit<TemplateInput, "setOrders">[] = CHILD.map((t, i) => ({
  ...t,
  audience: "child" as const,
  shortcut: i + 1,
}));