import type { OutpatientRow } from "@/lib/hospital-link";
import { inferStage, parseRoadmap, parseSoap, postOpBxTodo, type SurgeryFact } from "@/lib/clinic-view";
import { pathwayById, summaryLine } from "@/lib/pathways";
import { todoItems } from "@/lib/roadmap";

// 외래 명단 인쇄(사용자 2026-10-26) — A4 세로 표 한 칸: 기본 줄 + 오늘 할 것 + 로드맵 할 일(안 한 것만) + 지난 진료 요약.
// 데이터는 진료 브리핑(/m)과 같은 곳(로드맵 최신 판·진료 경로·외래 요약·이 사이트 수술)에서 읽어 넘긴다

export type PrintInput = {
  row: OutpatientRow;
  roadmapText: string; // 최신 로드맵 판, 없으면 명단 행에 붙은 것
  done: string[];
  pathways: { pathwayId: string; stageId: string; confirmed: boolean; proposedReason: string | null }[];
  visits: { visitDate: string; summary: string }[];
  surgeries: SurgeryFact[];
};

export type PrintRow = {
  time: string;
  name: string;
  sexAge: string;
  chartNo: string;
  visit: string;
  diagnosis: string;
  today: string[];
  todos: string[];
  last: string;
};

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 종이에 남는 이름 — 가운데 글자를 *로(두 글자면 뒤 글자). 수술 일정에서 다른 교수님 환자 가린 것과 같은 규칙
export function maskName(name: string): string {
  const n = name.trim();
  if (n.length < 2) return n;
  if (n.length === 2) return `${n[0]}*`;
  return `${n[0]}${"*".repeat(n.length - 2)}${n[n.length - 1]}`;
}

export function buildPrintRow(input: PrintInput, date: string, opts: { mask: boolean }): PrintRow {
  const { row, roadmapText, done, pathways, visits, surgeries } = input;

  // 오늘 할 것: 수술 후 첫 외래 Bx. 확인 → 다가오는 수술 → 진료 경로 지금 단계 할 일
  const today: string[] = [];
  const bx = postOpBxTodo(surgeries, visits.map((v) => v.visitDate), date);
  if (bx) today.push(bx);
  const next = surgeries.filter((s) => !s.done && s.date >= date).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) today.push(`수술 예정 ${md(next.date)} ${next.name}`);
  for (const p of pathways) {
    const call = inferStage(p, surgeries, date, pathways.length);
    const stage = call && pathwayById(p.pathwayId)?.stages.find((s) => s.id === call.stageId);
    // 수술 단계는 위 "수술 예정" 줄이 대신한다
    if (stage && stage.id !== "surgery" && stage.todo.length) today.push(`${stage.name}: ${stage.todo.join(" · ")}`);
  }

  const doneSet = new Set(done);
  const todos = todoItems(roadmapText).filter((t) => !doneSet.has(t));

  const lastVisit = visits.filter((v) => v.visitDate < date).sort((a, b) => b.visitDate.localeCompare(a.visitDate))[0];
  const last = lastVisit
    ? `${md(lastVisit.visitDate)} ${lastVisit.summary}`
    : parseRoadmap(roadmapText).now || summaryLine(roadmapText) || parseSoap(row.soap).core;

  return {
    time: row.time,
    name: opts.mask ? maskName(row.name) : row.name,
    sexAge: [row.sex, row.age].filter(Boolean).join("/"),
    chartNo: row.chartNo,
    visit: row.visit,
    diagnosis: row.diagnosis,
    today,
    todos,
    last,
  };
}
