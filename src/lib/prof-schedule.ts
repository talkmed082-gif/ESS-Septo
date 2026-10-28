import * as z from "zod";

// 교수님별 외래 인원·수술 — 병원 PC(prof_schedule.ps1)가 평일 아침 앞으로 2주치를 올린다(사용자 2026-10-25).
// 외래는 인원 수만, 수술은 텔레그램 수술 알림과 같은 수준(이름 가운데 가림·나이/성별·등록번호·수술명).
// 표·달력에 이 순서로(사용자 2026-10-28 "정일구 문수진 박지환 최성욱")
export const PROFESSORS = ["정일구", "문수진", "박지환", "최성욱"] as const;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ProfSurgerySchema = z.object({
  name: z.string().max(20),
  age: z.string().max(10).optional().default(""),
  sex: z.string().max(4).optional().default(""),
  chartNo: z.string().max(20),
  op: z.string().max(300),
  // YES 수술방 번호(사용자 2026-10-26) — 예전 병원 PC 스크립트는 안 보내서 없을 수 있다
  room: z.string().max(20).optional(),
  // 오전/오후 수술(사용자 2026-10-28 달력 "박 오전 수술 1") — 병원 PC가 보낼 때만 있다
  half: z.enum(["오전", "오후"]).optional(),
});
export type ProfSurgery = z.infer<typeof ProfSurgerySchema>;

// 66·77·88·99번 방은 YES에서 취소된 수술(사용자 2026-10-26) — 보이되 "취소"로, 건수에서는 뺀다
const CANCELLED_ROOMS = new Set([66, 77, 88, 99]);
const roomNumber = (room: string | null | undefined) => {
  const m = /\d+/.exec(room ?? "");
  return m ? Number(m[0]) : null;
};
export const isCancelledRoom = (room: string | null | undefined) => {
  const n = roomNumber(room);
  return n !== null && CANCELLED_ROOMS.has(n);
};
export const roomLabel = (room: string | null | undefined) => {
  const n = roomNumber(room);
  return n === null ? "" : `${n}번방`;
};
// 엑셀·병원 PC로 가져온 수술 계획 메모의 "Room23 #1 · assist …" 줄(buildImportPlanNote)에서 방 — YES 수술실 칸은 "05"처럼 번호만일 수도
export const planNoteRoom = (note: string | null | undefined) => /^((?:Room\s*)?\d+(?:번방)?)\s+#/m.exec(note ?? "")?.[1] ?? null;

export function splitCancelled(surgeries: ProfSurgery[]) {
  return {
    active: surgeries.filter((s) => !isCancelledRoom(s.room)),
    cancelled: surgeries.filter((s) => isCancelledRoom(s.room)),
  };
}

export const PROF_OFF_KINDS = ["오전 반차", "오후 반차", "반차", "연차", "출장", "휴가", "반일 휴가"] as const;
export const ProfScheduleBodySchema = z
  .object({
    from: ymd,
    to: ymd,
    items: z
      .array(
        z.object({
          date: ymd,
          doctor: z.enum(PROFESSORS),
          outpatient: z.number().int().min(0).max(1000),
          // 오전/오후 외래 인원(사용자 2026-10-28 "오후 외래 11") — 병원 PC가 보낼 때만, outpatient는 합계
          outpatientAm: z.number().int().min(0).max(1000).nullable().optional().default(null),
          outpatientPm: z.number().int().min(0).max(1000).nullable().optional().default(null),
          surgeries: z.array(ProfSurgerySchema).max(50),
          // 그날 부재 — 오전 반차·오후 반차·반차·연차·출장·휴가(사용자 2026-10-27 종류 구분, 사유는 안 받음). "반일 휴가"는 예전 값
          off: z.enum(PROF_OFF_KINDS).nullable().optional().default(null),
        }),
      )
      .max(500),
  })
  .refine((b) => b.from <= b.to && b.items.every((i) => b.from <= i.date && i.date <= b.to), "기간 밖 날짜가 있습니다.");
// 오전/오후가 안 붙은 반차("반차"·예전 "반일 휴가")는 모른다고 보인다(사용자 2026-10-28 "반차는 오전인지 오후인지")
export const offLabel = (off: string) => (off === "반차" || off === "반일 휴가" ? "반차(오전/오후 미확인)" : off);
export type ProfScheduleBody = z.infer<typeof ProfScheduleBodySchema>;

export function parseProfSurgeries(value: unknown): ProfSurgery[] {
  const p = z.array(ProfSurgerySchema).safeParse(value);
  return p.success ? p.data : [];
}
