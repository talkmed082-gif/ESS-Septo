import * as z from "zod";

// 노트북에 맡기는 외래 일감 — 진료 어시스트 [오늘 외래]에서 고른 환자마다 할 일(기록지 템플릿·진단 확인·비인강경 오더)
export const OpdJobTasksSchema = z.object({ note: z.boolean().default(true), dx: z.boolean().default(true), scope: z.boolean().default(true) });
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

export const OpdJobResultSchema = z.object({
  id: z.string().min(1).max(40),
  status: z.enum(["done", "failed", "waiting"]),
  result: z.string().max(2000).default(""),
});

export type JobLite = { status: string; updatedAt: Date; tries: number };

// 다음에 처리할 일감: 대기(pending) 먼저, 그다음 "나중에 다시"(waiting — 접수 전 등)는 2분 지난 것만, 10번까지.
// 처리 중(running)이 10분 넘게 끝나지 않으면(노트북이 멈춘 경우) 다시 가져간다
export function isClaimable(j: JobLite, now: Date): boolean {
  const age = now.getTime() - j.updatedAt.getTime();
  if (j.status === "pending") return true;
  if (j.status === "waiting") return age >= 2 * 60_000 && j.tries < 10;
  if (j.status === "running") return age >= 10 * 60_000 && j.tries < 10;
  return false;
}
