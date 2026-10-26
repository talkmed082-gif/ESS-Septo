import * as z from "zod";
import type { OutpatientRow } from "@/lib/hospital-link";

// 폰 진료 화면(/m, 2026-10-26) — 환자 번호는 그날 명단의 시간 순서(1부터). 진료 어시스트도 같은 규칙으로 "지금 N번"을 띄운다:
// 시간 오름차순, 같은 시간은 명단에 있던 순서(정렬이 안정적이라 그대로 남는다)
export function clinicOrder<T extends Pick<OutpatientRow, "time">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
}

// [Claude에게 묻기] — 자주 묻는 것은 버튼으로. 답은 3~5줄(노트북 작업자 프롬프트에서 제한)
export const ASK_PRESETS = ["지난 외래 이후 바뀐 것", "오늘 확인할 것", "수술·검사 이력", "약 처방 경과"] as const;
export const ASK_MAX = 300;

export const ClinicAskSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chartNo: z.string().trim().regex(/^\d{4,12}$/),
  question: z.string().trim().min(1, "질문을 적어 주세요.").max(ASK_MAX, `질문은 ${ASK_MAX}자까지입니다.`),
});

export const ClinicAskResultSchema = z.object({
  id: z.string().min(1).max(40),
  ok: z.boolean(),
  answer: z.string().max(4000).default(""),
});

// 노트북이 이 시간 안에 가져가지 않으면 꺼진 것으로 본다(폰에 "노트북 응답 없음"). 가져간 뒤 답이 이만큼 늦으면 실패
export const ASK_PICKUP_MS = 60_000;
export const ASK_ANSWER_MS = 5 * 60_000;

export type AskView = { id: string; status: string; answer: string | null; question: string };

// 화면에 보일 상태 — 시간이 지나도 pending/running이면 멈춘 것으로
export function askState(a: { status: string; createdAt: Date; answeredAt: Date | null }, now: Date): "waiting" | "running" | "done" | "failed" | "nopickup" | "timeout" {
  const age = now.getTime() - a.createdAt.getTime();
  if (a.status === "pending") return age > ASK_PICKUP_MS ? "nopickup" : "waiting";
  if (a.status === "running") return age > ASK_ANSWER_MS ? "timeout" : "running";
  return a.status === "done" ? "done" : "failed";
}

// 진료 상태(진료 브리핑 색): wait 진료 전(초록), now 진료 중, done 완료(회색).
// 진료실 PC 도우미가 기록지를 연 때(openedAt)로 자동 판정 — 마지막으로 연 환자 = 진료 중, 그 전에 연 환자 = 완료. done이 있으면 직접 정한 것
export type VisitStatus = "wait" | "now" | "done";
export const normChart = (c: string) => c.trim().replace(/^0+/, "");
export function visitStatuses(marks: { chartNo: string; openedAt: Date | null; done: boolean | null }[]): Map<string, VisitStatus> {
  const out = new Map<string, VisitStatus>();
  const opened = marks.filter((m) => m.openedAt && m.done !== true).sort((a, b) => b.openedAt!.getTime() - a.openedAt!.getTime());
  const latest = opened[0]?.chartNo;
  for (const m of marks) {
    const k = normChart(m.chartNo);
    if (m.done === true) out.set(k, "done");
    else if (m.chartNo === latest) out.set(k, "now");
    else if (m.done === false || !m.openedAt) out.set(k, "wait");
    else out.set(k, "done");
  }
  return out;
}

// 노트북 작업자 작업 시간(진료 어시스트 [설정], 2026-10-26). 노트북 예약 작업은 06:00에 켜서 시작 시각까지 기다린다 → 시작은 06:00 이후
export const WORKER_DEFAULT = { from: "07:30", until: "19:00" };
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시각은 07:30처럼 적어 주세요.");
export const WorkerHoursSchema = z
  .object({ from: hhmm, until: hhmm })
  .refine((h) => h.from >= "06:00", { message: "시작은 06:00 이후로 해 주세요." })
  .refine((h) => h.from < h.until, { message: "끝 시각이 시작보다 늦어야 합니다." });
