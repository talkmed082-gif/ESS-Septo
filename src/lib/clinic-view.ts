import { pathwayById } from "@/lib/pathways";

// 웹 진료 화면(/clinic)용 — AI SOAP·로드맵 글을 칸으로 나누고, 지금 단계를 사실(수술 날짜·수술 예정)로 판정한다

// AI SOAP 글(핵심:/S:/O:/A:/P:)을 칸별로. 칸 머리 없는 줄은 앞 칸에 붙인다
export type SoapParts = { core: string; S: string; O: string; A: string; P: string; other: string };
export function parseSoap(text: string | null | undefined): SoapParts {
  const out: SoapParts = { core: "", S: "", O: "", A: "", P: "", other: "" };
  let cur: keyof SoapParts = "other";
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(핵심|S|O|A|P)\s*[:：]\s*(.*)$/.exec(line);
    if (m) {
      cur = m[1] === "핵심" ? "core" : (m[1] as "S" | "O" | "A" | "P");
      if (m[2]) out[cur] = out[cur] ? `${out[cur]}\n${m[2]}` : m[2];
      continue;
    }
    out[cur] = out[cur] ? `${out[cur]}\n${line}` : line;
  }
  return out;
}

// 로드맵 글(요약:/경과:/현재:/할 일:/확인:)을 칸별로 — 할 일(□ …)은 RoadmapBox가 체크하므로 글 그대로 둔다
export type RoadmapParts = { summary: string; course: string[]; now: string; todo: string; check: string; other: string };
export function parseRoadmap(text: string | null | undefined): RoadmapParts {
  type Key = "summary" | "course" | "now" | "todo" | "check" | "other";
  const KEYS: Record<string, Key> = { 요약: "summary", 경과: "course", 현재: "now", "할 일": "todo", 확인: "check" };
  const out: RoadmapParts = { summary: "", course: [], now: "", todo: "", check: "", other: "" };
  let cur = "other" as Key;
  const add = (k: Exclude<Key, "course">, v: string) => (out[k] = out[k] ? `${out[k]}\n${v}` : v);
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(요약|경과|현재|할 일|확인)\s*[:：]\s*(.*)$/.exec(line);
    if (m) {
      cur = KEYS[m[1]];
      if (m[2]) {
        const k = cur;
        if (k === "course") out.course.push(m[2]);
        else add(k, m[2]);
      }
      continue;
    }
    if (cur === "course") out.course.push(line.replace(/^[-·•]\s*/, ""));
    else add(cur, line);
  }
  return out;
}

// 수술 후 지난 날수 → 술후 단계(경로마다). 마지막 칸은 그 뒤 전부
const POST_OP: Record<string, [number, string][]> = {
  septo: [[10, "po1"], [42, "po2"], [Infinity, "po3"]],
  crs_snp: [[21, "po_early"], [270, "po_1_6m"], [Infinity, "po_1y"]],
  crs_t2: [[21, "po_early"], [Infinity, "po_follow"]],
  ip: [[21, "po_early"], [730, "surv_2y"], [Infinity, "surv_annual"]],
  osa: [[Infinity, "po"]],
};
// 어떤 수술이 그 경로의 수술인지(수술 종류 이름). 환자 경로가 하나면 이름이 안 맞아도 그 경로로 본다
const SURGERY_NAME: Record<string, RegExp> = {
  septo: /septo|비중격|갑개|turbin/i,
  crs_snp: /ESS|부비동|sinus/i,
  crs_t2: /ESS|부비동|sinus/i,
  ip: /ESS|부비동|sinus|유두종|papilloma|종물|mass/i,
  osa: /UPPP|수면|구개|palat|OSA/i,
};

export type SurgeryFact = { date: string; name: string; done: boolean }; // date yyyy-MM-dd(서울)
export type StageCall = { stageId: string; reason: string; source: "surgery" | "plan" | "doctor" | "ai" };

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 지금 단계 판정: ① 이 사이트의 수술 기록(날짜) → 술후 단계 ② 앞으로 잡힌 수술 → 수술 단계 ③ 의사 확정 ④ AI 제안.
// 수술 사실은 수술 전·술후 단계일 때만 쓴다(유지·생물학적 제제·종결처럼 그 뒤 단계로 의사가 옮긴 것은 그대로)
export function inferStage(
  pp: { pathwayId: string; stageId: string; confirmed: boolean; proposedReason: string | null },
  surgeries: SurgeryFact[],
  today: string,
  pathwayCount = 1,
): StageCall | null {
  const def = pathwayById(pp.pathwayId);
  if (!def) return null;
  const idx = (id: string) => def.stages.findIndex((s) => s.id === id);
  const surgeryIdx = idx("surgery");
  const po = POST_OP[def.id];
  const curIdx = idx(pp.stageId);
  const poIds = new Set((po ?? []).map(([, id]) => id));
  const beforeOrPostOp = surgeryIdx >= 0 && (curIdx <= surgeryIdx || poIds.has(pp.stageId));
  const mine = surgeries.filter((s) => (SURGERY_NAME[def.id]?.test(s.name) ?? false) || pathwayCount === 1);

  if (po && beforeOrPostOp) {
    const last = mine.filter((s) => s.done && s.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (last) {
      const days = daysBetween(last.date, today);
      const stageId = po.find(([max]) => days <= max)![1];
      return { stageId, reason: `수술 ${md(last.date)} ${last.name} · ${days}일째`, source: "surgery" };
    }
    const next = mine.filter((s) => !s.done && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next && curIdx <= surgeryIdx) return { stageId: "surgery", reason: `수술 예정 ${md(next.date)} ${next.name}`, source: "plan" };
  }
  if (pp.confirmed) return { stageId: pp.stageId, reason: "의사 확정", source: "doctor" };
  return { stageId: pp.stageId, reason: pp.proposedReason ? `AI: ${pp.proposedReason}` : "AI 제안(기록 기준)", source: "ai" };
}

// 수술 후 첫 외래면 "Bx. 확인"(사용자 2026-10-26) — 마지막 수술(한 것) 뒤로 이 사이트에 외래 요약이 없고, 수술이 120일 안이면.
// 같은 □ 할 일로 다뤄 체크할 수 있게 글을 돌려준다(없으면 null)
export function postOpBxTodo(surgeries: SurgeryFact[], visitDates: string[], today: string): string | null {
  const last = surgeries.filter((s) => s.done && s.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return null;
  if ((Date.parse(today) - Date.parse(last.date)) / 86_400_000 > 120) return null;
  if (visitDates.some((d) => d > last.date && d < today)) return null;
  return `Bx. 확인(수술 ${Number(last.date.slice(5, 7))}/${Number(last.date.slice(8, 10))})`;
}
