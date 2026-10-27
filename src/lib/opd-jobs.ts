import * as z from "zod";

// 외래 일감 — 할 일(기록지 템플릿·진단 확인·비인강경 오더)과 처리할 곳.
// laptop: 진료 어시스트 [오늘 외래]에서 노트북에 맡긴 것(노트북이 환자를 골라 처리)
// clinic: 웹 진료 화면에서 진료실 PC로 보낸 것(진료실 PC 진료 어시스트가 그 환자 기록지가 열려 있을 때 바로 처리, 2026-10-25)
// soap: 재진은 이전 기록 대신 사이트 SOAP 요약(외래 전날 AI)으로 S·O·A·P(사용자 2026-10-26)
// dot: 초진은 템플릿이 없으면 모든 칸에 "."
// saveOnly: 오더(비인강경·처방 서명) 없이 기록지 저장까지만
// scope(비인강경)는 기본 끔(사용자 2026-10-27 "기본으로 하면 안 돼 — 취소하기 귀찮아")
export const OpdJobTasksSchema = z.object({
  note: z.boolean().default(true),
  dx: z.boolean().default(true),
  scope: z.boolean().default(false),
  soap: z.boolean().default(false),
  dot: z.boolean().default(false),
  saveOnly: z.boolean().default(false),
  where: z.enum(["laptop", "clinic"]).default("laptop"),
});
export type OpdJobTasks = z.infer<typeof OpdJobTasksSchema>;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const chartNo = z.string().trim().regex(/^\d{4,12}$/);

export const OpdJobSubmitSchema = z.object({
  visitDate: date,
  practice: z.boolean().default(false),
  items: z
    .array(z.object({ chartNo, name: z.string().max(40).default(""), visit: z.string().max(10).default(""), templateId: z.string().max(40).nullable().default(null), tasks: OpdJobTasksSchema }))
    .min(1)
    .max(80),
});

// 웹 진료 화면 [보내기] — 한 환자. 보낼 곳 기본은 노트북(환자 선택부터 혼자 함, 사용자 2026-10-25 "자동화는 노트북이 나아")
export const ClinicJobSchema = z.object({
  where: z.enum(["laptop", "clinic"]).default("laptop"),
  visitDate: date,
  chartNo,
  name: z.string().max(40).default(""),
  visit: z.string().max(10).default(""),
  templateId: z.string().max(40).nullable().default(null),
  practice: z.boolean().default(false),
  note: z.boolean(),
  dx: z.boolean(),
  scope: z.boolean(),
});

// 진료 화면 보내기 기본값(User.clinicSendDefaults) — 환자별 칸·하루치 칸이 이 값으로 시작. 저장값이 깨졌으면 기본값
export const ClinicDefaultsSchema = z.object({
  where: z.enum(["laptop", "clinic"]).default("laptop"),
  note: z.boolean().default(true),
  dx: z.boolean().default(true),
  scope: z.boolean().default(false),
});
export type ClinicDefaults = z.infer<typeof ClinicDefaultsSchema>;
export const clinicDefaults = (v: unknown): ClinicDefaults => {
  const r = ClinicDefaultsSchema.safeParse(v ?? {});
  return r.success ? r.data : ClinicDefaultsSchema.parse({});
};

// running = 처리 중 단계 보고(result에 "환자 선택 중" 등, 사용자 2026-10-27 "노트북이 뭘 하고 있는지") — 이미 처리 중인 일감만 바뀐다
export const OpdJobResultSchema = z.object({
  id: z.string().min(1).max(40),
  status: z.enum(["done", "failed", "waiting", "running"]),
  result: z.string().max(2000).default(""),
});

export type JobLite = { status: string; updatedAt: Date; tries: number };

export const jobWhere = (tasks: unknown): "laptop" | "clinic" =>
  tasks && typeof tasks === "object" && (tasks as { where?: unknown }).where === "clinic" ? "clinic" : "laptop";

// 다음에 처리할 일감: 대기(pending) 먼저, 그다음 "나중에 다시"(waiting — 접수 전 등)는 3분 지난 것만.
// 하루치를 아침(노트북 07:30~)에 한꺼번에 돌리므로 늦게 접수되는 환자까지 그날 안에는 계속(예전 2분·10번이면 20분 뒤 멈췄음, 2026-10-25).
// 처리 중(running)이 10분 넘게 끝나지 않으면(노트북이 멈춘 경우) 다시 가져간다(10번까지).
// 진료실 PC 일감은 의사가 그 환자를 열면 곧바로 해야 해서 waiting 15초, 멈춘 running 2분, 횟수 제한 없음(오늘 것만)
export function isClaimable(j: JobLite, now: Date, where: "laptop" | "clinic" = "laptop"): boolean {
  const age = now.getTime() - j.updatedAt.getTime();
  if (j.status === "pending") return true;
  if (where === "clinic") {
    if (j.status === "waiting") return age >= 15_000;
    if (j.status === "running") return age >= 2 * 60_000;
    return false;
  }
  if (j.status === "waiting") return age >= 3 * 60_000 && j.tries < 200;
  if (j.status === "running") return age >= 10 * 60_000 && j.tries < 10;
  return false;
}
