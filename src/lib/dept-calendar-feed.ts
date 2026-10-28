import type { CalendarFeedEvent } from "@/lib/calendar";
import { maskName } from "@/lib/outpatient-print";
import { offLabel, parseProfSurgeries, roomLabel, splitCancelled } from "@/lib/prof-schedule";

// 비과 전체 일정 구독 피드(사용자 2026-10-28 "최성욱 선생님도 캘린더로 보게") — 교수님 4분 수술·외래·부재를
// 구글/애플 캘린더에 그대로. 환자는 이름 가운데만 가려서(홍*동), 등록번호·나이·성별은 넣지 않는다.
// 취소된 수술(66·77·88·99번 방)은 다른 화면처럼 뺀다.
export interface DeptScheduleRow {
  date: string; // yyyy-MM-dd(서울)
  doctor: string;
  outpatient: number;
  outpatientAm: number | null;
  outpatientPm: number | null;
  surgeries: unknown;
  off: string | null;
  updatedAt: Date;
}

// 오전/오후만 아는 일정의 기본 시각(서울) — 오전 09–12, 오후 13–17
const HALF_HOURS = { 오전: [9, 12], 오후: [13, 17] } as const;

// 서울 시각(UTC+9, 서머타임 없음) → UTC Date
function seoulTime(date: string, hour: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 9));
}

function halfRange(date: string, half: "오전" | "오후") {
  const [from, to] = HALF_HOURS[half];
  return { start: seoulTime(date, from), end: seoulTime(date, to) };
}

// 피드에 실을 환자 이름 — 가운데 글자 가림(홍길동 → 홍*동, 김수 → 김*). 병원 PC가 이미 가린 이름도 그대로 남는다
export const maskPatientName = maskName;

// UID는 날짜·교수님·종류(수술은 그날 순번)로 — 병원 PC가 기간을 통째로 다시 올려 행 id가 바뀌어도
// 같은 일정은 같은 UID라 캘린더에서 겹치지 않고 바뀐 내용으로 덮어쓴다
const uid = (row: DeptScheduleRow, kind: string) => `dept-${row.date}-${encodeURIComponent(row.doctor)}-${kind}@ess-septo`;

export function deptRowToEvents(row: DeptScheduleRow): CalendarFeedEvent[] {
  const date = new Date(`${row.date}T00:00:00.000Z`);
  const base = { date, updatedAt: row.updatedAt };
  const who = `[${row.doctor}]`;
  const events: CalendarFeedEvent[] = [];

  if (row.off) events.push({ ...base, uid: uid(row, "off"), title: `${who} ${offLabel(row.off)}` });

  // 외래 — 오전/오후 인원이 오면 시각 일정으로 나눠서, 합계만 있으면 종일로
  if (row.outpatientAm !== null || row.outpatientPm !== null) {
    for (const [half, n, kind] of [["오전", row.outpatientAm, "am"], ["오후", row.outpatientPm, "pm"]] as const) {
      if (n) events.push({ ...base, ...halfRange(row.date, half), uid: uid(row, kind), title: `${who} ${half} 외래 ${n}명` });
    }
  } else if (row.outpatient > 0) {
    events.push({ ...base, uid: uid(row, "opd"), title: `${who} 외래 ${row.outpatient}명` });
  }

  const { active } = splitCancelled(parseProfSurgeries(row.surgeries));
  active.forEach((s, i) => {
    const label = [s.half ? `${s.half} 수술` : "수술", roomLabel(s.room)].filter(Boolean).join(" ");
    const patient = [maskPatientName(s.name), s.op.trim()].filter(Boolean).join(" ");
    events.push({
      ...base,
      ...(s.half ? halfRange(row.date, s.half) : {}),
      uid: uid(row, `op${i + 1}`),
      title: `${who} ${label}${patient ? ` · ${patient}` : ""}`,
    });
  });
  return events;
}
