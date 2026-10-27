import * as z from "zod";

// 외래 후 서명 전 기록지 정리(사용자 2026-10-27) — 노트북이 미리 저장한 기록지 중 안 온 환자 것을 EMR에서 지운다.
// 안 옴 = ① 그날 기록지 서명 안 됨 ② 그날 오더 없음 ③ 노트북이 쓴 뒤 고친 적 없음(EMR 작성 시각 = 수정 시각). 셋 다일 때만 후보.
// 지우기는 되돌릴 수 없어(EMR엔 사유와 함께 노랗게 남음) 후보를 보고 [삭제 승인]한 것만, 노트북이 지우기 직전에 셋을 다시 확인한다.
// OpdJob.noteState(문자열) 하나로 단계를 적는다:
//   null 처리 전 · "check" 확인 요청 · "noShow:<기록지번호>" 후보 · "keep:<이유>" 직접 확인 필요
//   "deleteRequested:<기록지번호>" 삭제 승인 · "deleteFailed:<이유>" · "signed" · "deleted"
export type NoteState =
  | { kind: "none" }
  | { kind: "check" }
  | { kind: "noShow"; noteId: string }
  | { kind: "keep"; reason: string }
  | { kind: "deleteRequested"; noteId: string }
  | { kind: "deleteFailed"; reason: string }
  | { kind: "signed" }
  | { kind: "deleted" };

const noteId = z.string().regex(/^\d{1,12}$/);

export function parseNoteState(s: string | null | undefined): NoteState {
  if (!s) return { kind: "none" };
  if (s === "check" || s === "signed" || s === "deleted") return { kind: s };
  const i = s.indexOf(":");
  const head = i < 0 ? s : s.slice(0, i), rest = i < 0 ? "" : s.slice(i + 1);
  if ((head === "noShow" || head === "deleteRequested") && noteId.safeParse(rest).success) return { kind: head, noteId: rest };
  if (head === "keep" || head === "deleteFailed") return { kind: head, reason: rest };
  return { kind: "none" };
}

// 처리 끝(목록에서 빠짐): 서명함·지움
export const isNoteDone = (s: NoteState) => s.kind === "signed" || s.kind === "deleted";

// 긴 이유 하나 때문에 결과 전체가 거부되지 않게 잘라서 받는다
const reason = z.string().trim().transform((s) => s.slice(0, 80));
export const NoteCleanupResultSchema = z.object({
  results: z
    .array(
      z.discriminatedUnion("state", [
        z.object({ id: z.string().min(1).max(40), state: z.literal("signed") }),
        z.object({ id: z.string().min(1).max(40), state: z.literal("deleted") }),
        z.object({ id: z.string().min(1).max(40), state: z.literal("noShow"), noteId }),
        z.object({ id: z.string().min(1).max(40), state: z.literal("keep"), reason }),
        z.object({ id: z.string().min(1).max(40), state: z.literal("deleteFailed"), reason }),
      ]),
    )
    .max(100),
});
export type NoteCleanupResult = z.infer<typeof NoteCleanupResultSchema>["results"][number];

// 노트북 결과를 받을 수 있는 단계만 바꾼다(그사이 사용자가 "서명함" 등으로 바꿨으면 그대로 둠).
// 확인(check) → 서명됨·후보·직접 확인·(이미 없음 = 지움) / 삭제 승인 → 지움·실패·서명됨·직접 확인(다시 확인해 보니 조건이 깨짐)
export function nextNoteState(current: string | null, r: NoteCleanupResult): string | null {
  const cur = parseNoteState(current);
  if (cur.kind === "check") {
    if (r.state === "signed" || r.state === "deleted") return r.state;
    if (r.state === "noShow") return `noShow:${r.noteId}`;
    if (r.state === "keep") return `keep:${r.reason}`;
    return null;
  }
  if (cur.kind === "deleteRequested") {
    if (r.state === "signed" || r.state === "deleted") return r.state;
    if (r.state === "keep") return `keep:${r.reason}`;
    if (r.state === "deleteFailed") return `deleteFailed:${r.reason}`;
    return null;
  }
  return null;
}

// [EMR에서 확인]: 처리 전·직접 확인·삭제 실패·후보를 다시 확인 요청(후보도 — 늦게 와서 서명했으면 서명됨으로 바뀌게). 확인·승인 대기는 그대로
export const canRequestCheck = (s: string | null) => ["none", "keep", "deleteFailed", "noShow"].includes(parseNoteState(s).kind);
