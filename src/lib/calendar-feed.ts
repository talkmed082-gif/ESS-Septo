import { randomBytes } from "node:crypto";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildProcedureName } from "@/lib/op-note-generator";
import type { CalendarFeedEvent } from "@/lib/calendar";

export interface FeedPlan {
  id: string;
  plannedDate: Date;
  updatedAt: Date;
  status: string;
  planData: unknown;
  surgeryType: { code: string; name: string };
}

// 캘린더에는 개인정보 보호를 위해 수술명과 날짜만 넣는다 — 환자 이름, 차트번호,
// 계획 메모는 일부러 받지도 않는다.
export function planToCalendarEvent(plan: FeedPlan): CalendarFeedEvent {
  const values = parseFieldValues(plan.planData);
  const name = isBuiltInSurgeryCode(plan.surgeryType.code)
    ? buildProcedureName(plan.surgeryType.code, values)
    : plan.surgeryType.name;
  return {
    uid: `op-plan-${plan.id}@ess-septo`,
    title: plan.status === "DONE" ? `[완료] ${name}` : name,
    date: plan.plannedDate,
    updatedAt: plan.updatedAt,
  };
}

// 32바이트 무작위 값(base64url 43자) — 주소를 아는 사람만 피드를 읽을 수 있다.
export function generateCalendarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isCalendarTokenFormat(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}
