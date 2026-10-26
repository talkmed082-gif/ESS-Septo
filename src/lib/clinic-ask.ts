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
