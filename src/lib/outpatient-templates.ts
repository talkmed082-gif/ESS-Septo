import * as z from "zod";

// 외래 템플릿 — 진료실 PC 프로그램이 EMR 외래초진/경과 기록지 칸에 그대로 채운다.
// 칸 이름은 EMR 기록지 탭과 같다(초진: CC·PI·ROS·PE·Assessment·Plan, 경과: S·O·A·P).
export const TEMPLATE_KINDS = { symptom: "증상", diagnosis: "진단 받고 옴", exam: "검사" } as const;
export type TemplateKind = keyof typeof TEMPLATE_KINDS;

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

// 처음 쓸 때 만드는 기본 템플릿 초안(사용자가 고쳐 쓴다). 빈칸은 진료 중 채울 자리.
// CC는 EMR 초진 화면 아래 CC 목록의 이름과 같아야 프로그램이 골라 준다(목록에 없으면 비워 둠 → 직접 고름).
// "비인강경"(검사)은 이름으로 찾는다 — 프로그램의 [비인강경] 버튼이 초진 PE/경과 Objective에 덧붙이고 연결한 약속처방을 넣는다.
export const DEFAULT_TEMPLATES: Omit<TemplateInput, "setOrders">[] = [
  {
    ...empty,
    title: "코골이/수면무호흡",
    kind: "symptom",
    sortOrder: 10,
    firstCc: "snoring",
    firstPi: "onset:\n코골이 빈도:\n수면 중 무호흡 목격:\n주간 졸림(ESS):\n아침 두통/입마름:\n체중 변화:\n이전 PSG/CPAP:",
    firstRos: "nasal obstruction ( )\nrhinorrhea ( )",
    firstPe: "nasal cavity: septum / turbinate\noral cavity: tonsil grade ( ), Friedman tongue position ( )\nBMI:",
    firstAssessment: "r/o OSA",
    firstPlan: "PSG\nf/u after PSG",
    followObjective: "PSG: AHI / min SaO2",
    followAssessment: "OSA",
  },
  {
    ...empty,
    title: "콧물",
    kind: "symptom",
    sortOrder: 20,
    firstCc: "rhinorrhea",
    firstPi: "onset:\n양상: watery / mucoid / purulent\n전방/후비루:\n양측/편측:\n악화 요인(계절, 찬공기):\n이전 치료:",
    firstRos: "nasal obstruction ( )\nsneezing ( )\nhyposmia ( )",
    firstPe: "nasal cavity: discharge / turbinate / septum",
    firstAssessment: "",
    firstPlan: "",
  },
  {
    ...empty,
    title: "코막힘",
    kind: "symptom",
    sortOrder: 30,
    firstCc: "obstruction, nose",
    firstPi: "onset:\n양측/편측(교대 여부):\n지속/간헐:\n수면 중 입벌림:\n외상력:\n비강 스프레이 사용(종류, 기간):\n이전 치료/수술:",
    firstRos: "rhinorrhea ( )\nsneezing ( )\nhyposmia ( )\nsnoring ( )",
    firstPe: "nasal cavity: septum / turbinate / polyp\nexternal nose:",
    firstAssessment: "",
    firstPlan: "",
  },
  {
    ...empty,
    title: "두통/안면통",
    kind: "symptom",
    sortOrder: 40,
    firstCc: "",
    firstPi: "onset:\n부위:\n양상/강도:\n지속 시간/빈도:\n코 증상 동반(코막힘, 농성 콧물, 후각저하):\n악화 요인:\n진통제/이전 치료:",
    firstRos: "nasal obstruction ( )\npurulent rhinorrhea ( )\nhyposmia ( )",
    firstPe: "nasal cavity: middle meatus discharge / septum / turbinate",
    firstAssessment: "",
    firstPlan: "",
  },
  {
    ...empty,
    title: "재채기/알레르기",
    kind: "symptom",
    sortOrder: 50,
    firstCc: "sneezing",
    firstPi: "onset:\n계절성/통년성:\n가려움(코, 눈):\n유발 요인(먼지, 동물, 꽃가루):\n알레르기 검사 여부:\n이전 치료(항히스타민, 스프레이):",
    firstRos: "rhinorrhea ( )\nnasal obstruction ( )\nitching ( )",
    firstPe: "nasal cavity: pale turbinate / watery discharge / septum",
    firstAssessment: "r/o AR",
    firstPlan: "MAST",
  },
  {
    ...empty,
    title: "인후두 이물감",
    kind: "symptom",
    sortOrder: 60,
    firstCc: "foreign body sense",
    firstPi: "onset:\n위치:\n삼킴 곤란/통증:\n쉰목소리:\n위산 역류 증상(가슴쓰림, 신물):\n흡연/음주:\n체중 감소:",
    firstRos: "dysphagia ( )\nhoarseness ( )\nheartburn ( )",
    firstPe: "oral cavity / oropharynx:\nlaryngoscopy:",
    firstAssessment: "",
    firstPlan: "",
  },
  {
    ...empty,
    title: "무후각증",
    kind: "symptom",
    sortOrder: 70,
    firstCc: "anosmia",
    firstPi: "onset:\n갑자기/서서히:\n선행 감기/코로나:\n두부 외상:\n동반 코 증상(코막힘, 콧물):\n미각 변화:\n이전 치료(스테로이드):",
    firstRos: "nasal obstruction ( )\nrhinorrhea ( )\nheadache ( )",
    firstPe: "nasal cavity: olfactory cleft / polyp / septum",
    firstAssessment: "",
    firstPlan: "olfactory test",
  },
  {
    ...empty,
    title: "부비동염(진단 후 의뢰)",
    kind: "diagnosis",
    sortOrder: 110,
    firstCc: "",
    firstPi: "의뢰 병원/진단 시점:\n외부 영상(CT) 소견:\n증상(코막힘, 농성 콧물, 후각저하, 안면통):\n기간:\n이전 약물치료(항생제, 스테로이드, 기간):\n이전 수술:",
    firstRos: "",
    firstPe: "nasal cavity: middle meatus / polyp / discharge / septum",
    firstAssessment: "",
    firstPlan: "",
  },
  {
    ...empty,
    title: "종물(진단 후 의뢰)",
    kind: "diagnosis",
    sortOrder: 120,
    firstCc: "mass",
    firstPi: "의뢰 병원/진단 시점:\n위치:\n외부 영상/조직검사 결과:\n증상(코피, 편측 코막힘, 통증, 시력/복시):\n기간:\n흡연:",
    firstRos: "epistaxis ( )\nunilateral obstruction ( )",
    firstPe: "nasal cavity / nasopharynx:\nneck:",
    firstAssessment: "",
    firstPlan: "",
  },
{
    ...empty,
    title: "비인강경",
    kind: "exam",
    sortOrder: 200,
    firstPe: "<비강 소견>",
    followObjective: "<비강 소견>",
  },
];
