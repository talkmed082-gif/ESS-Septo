import { describe, expect, it } from "vitest";
import { NoteCleanupResultSchema, canRequestCheck, isNoteDone, nextNoteState, parseNoteState } from "./note-cleanup";

describe("외래 후 서명 전 기록지 정리", () => {
  it("상태 글 읽기 — 깨진 값은 처리 전으로", () => {
    expect(parseNoteState(null)).toEqual({ kind: "none" });
    expect(parseNoteState("check")).toEqual({ kind: "check" });
    expect(parseNoteState("noShow:41378450")).toEqual({ kind: "noShow", noteId: "41378450" });
    expect(parseNoteState("deleteRequested:41378450")).toEqual({ kind: "deleteRequested", noteId: "41378450" });
    expect(parseNoteState("keep:오더 있음")).toEqual({ kind: "keep", reason: "오더 있음" });
    expect(parseNoteState("deleteFailed:서명됨: 다시")).toEqual({ kind: "deleteFailed", reason: "서명됨: 다시" });
    // 기록지 번호가 숫자가 아니면 후보·승인으로 보지 않음(노트북에 엉뚱한 번호가 넘어가지 않게)
    expect(parseNoteState("noShow:abc")).toEqual({ kind: "none" });
    expect(parseNoteState("deleteRequested:")).toEqual({ kind: "none" });
    expect(isNoteDone(parseNoteState("signed"))).toBe(true);
    expect(isNoteDone(parseNoteState("noShow:1"))).toBe(false);
  });

  it("노트북 결과는 확인·승인 단계에서만 받는다", () => {
    expect(nextNoteState("check", { id: "a", state: "noShow", noteId: "41378450" })).toBe("noShow:41378450");
    expect(nextNoteState("check", { id: "a", state: "keep", reason: "그날 오더 있음" })).toBe("keep:그날 오더 있음");
    expect(nextNoteState("check", { id: "a", state: "signed" })).toBe("signed");
    // 확인만 했는데 "지움 실패"는 말이 안 됨
    expect(nextNoteState("check", { id: "a", state: "deleteFailed", reason: "x" })).toBeNull();
    expect(nextNoteState("deleteRequested:1", { id: "a", state: "deleted" })).toBe("deleted");
    expect(nextNoteState("deleteRequested:1", { id: "a", state: "deleteFailed", reason: "응답 없음" })).toBe("deleteFailed:응답 없음");
    // 승인하지 않은 후보·사용자가 이미 처리한 것은 바뀌지 않음
    expect(nextNoteState("noShow:1", { id: "a", state: "deleted" })).toBeNull();
    expect(nextNoteState("signed", { id: "a", state: "deleted" })).toBeNull();
    expect(nextNoteState(null, { id: "a", state: "noShow", noteId: "1" })).toBeNull();
  });

  it("결과 형식 — 후보는 숫자 기록지 번호가 있어야 함", () => {
    expect(NoteCleanupResultSchema.safeParse({ results: [{ id: "a", state: "noShow", noteId: "41378450" }] }).success).toBe(true);
    expect(NoteCleanupResultSchema.safeParse({ results: [{ id: "a", state: "noShow" }] }).success).toBe(false);
    expect(NoteCleanupResultSchema.safeParse({ results: [{ id: "a", state: "deleteRequested", noteId: "1" }] }).success).toBe(false);
  });

  it("다시 확인 요청은 처리 전·직접 확인·실패·후보만", () => {
    expect([null, "keep:x", "deleteFailed:y", "noShow:1"].map(canRequestCheck)).toEqual([true, true, true, true]);
    expect(["check", "deleteRequested:1", "signed", "deleted"].map(canRequestCheck)).toEqual([false, false, false, false]);
  });

  it("긴 이유는 잘라서 받음(결과 전체 거부 안 함)", () => {
    const p = NoteCleanupResultSchema.parse({ results: [{ id: "a", state: "keep", reason: "가".repeat(200) }] });
    expect(p.results[0].state === "keep" && p.results[0].reason.length).toBe(80);
  });
});
