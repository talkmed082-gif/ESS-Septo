import * as z from "zod";

// 환자별 로드맵 — 형식: 경과 / 현재 / 할 일(□ …) / 확인. 할 일 체크는 □ 뒤 글 그대로 저장한다.

// "할 일: □ a □ b\n□ c" 처럼 한 줄에 여러 개가 와도 □ 단위로 나눈다
export function todoItems(text: string): string[] {
  return [...text.matchAll(/□\s*([^□\n]+)/g)].map((m) => m[1].trim()).filter(Boolean);
}

// 새 로드맵으로 바뀌어도 같은 글의 할 일은 체크를 이어 간다
export function carryDone(done: string[], newText: string): string[] {
  const items = new Set(todoItems(newText));
  return done.filter((d) => items.has(d));
}

export function parseDone(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

const chartNo = z.string().trim().regex(/^\d{4,12}$/);

// 진료실 프로그램 [로드맵 저장] — 지금 열린 기록지 글
export const VisitNoteBodySchema = z.object({
  chartNo,
  kind: z.enum(["first", "follow"]),
  text: z.string().trim().min(1).max(20000),
});

// 노트북 저녁 작업이 올리는 갱신 로드맵(그 기록으로 만든 것 — noteIds는 처리 표시용)
export const RoadmapUpdateBodySchema = z.object({
  items: z
    .array(z.object({ chartNo, text: z.string().trim().min(1).max(4000), noteIds: z.array(z.string().max(40)).max(20).default([]) }))
    .max(300),
});
