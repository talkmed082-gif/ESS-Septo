import * as z from "zod";

// 진료 경로(CP) — 질환별 단계와 갈림길. 환자는 경로마다 "지금 단계"를 갖는다(AI 제안 → 의사 확정).
// 내용은 roadmap_guide.txt(EPOS 2020 등)로 만든 초안 — 의사가 검토해 고친다. 단계 id는 바꾸지 않는다(환자 기록이 가리킴)
export type Decision = { q: string; options: { label: string; to?: string; note?: string }[] };
export type Stage = { id: string; name: string; when: string; next?: string; todo: string[]; decide?: Decision };
export type Pathway = { id: string; name: string; maxFollow: string; stages: Stage[] };

export const PATHWAYS: Pathway[] = [
  {
    id: "septo",
    name: "비중격·하비갑개 (코막힘)",
    maxFollow: "수술 후 6개월(증상 재발 시 재평가)",
    stages: [
      { id: "eval", name: "초진 평가", when: "초진", next: "4주", todo: ["코막힘 방향·기간", "내시경(비중격·하비갑개)", "필요 시 음향비강통기도검사"] },
      {
        id: "med", name: "약물치료", when: "4~8주", next: "4주", todo: ["비강 스테로이드 ± 항히스타민"],
        decide: { q: "약물에 반응?", options: [{ label: "호전", to: "end" }, { label: "지속", to: "decide" }] },
      },
      {
        id: "decide", name: "수술 결정", when: "약물 후", next: "2주", todo: ["수술 설명·동의", "수술 전 검사"],
        decide: { q: "수술?", options: [{ label: "수술", to: "surgery" }, { label: "약물 계속", to: "med" }] },
      },
      { id: "surgery", name: "수술", when: "", next: "1주", todo: ["Septoplasty ± turbinate surgery"] },
      { id: "po1", name: "술후 1주", when: "1주", next: "2주", todo: ["스플린트·패킹 제거", "가피 정리"] },
      { id: "po2", name: "술후 2~4주", when: "2~4주", next: "2개월", todo: ["점막 치유·유착 확인"] },
      {
        id: "po3", name: "술후 3개월", when: "3개월", next: "3개월", todo: ["증상 평가"],
        decide: { q: "증상?", options: [{ label: "없음 → 종결", to: "end" }, { label: "남음 → 재평가", to: "med" }] },
      },
      { id: "end", name: "종결", when: "", todo: ["증상 재발 시 재방문"] },
    ],
  },
  {
    id: "crs_snp",
    name: "만성 부비동염 (용종 없음)",
    maxFollow: "수술 후 1~2년(이후 증상 시)",
    stages: [
      { id: "eval", name: "초진 평가", when: "초진", next: "4주", todo: ["증상·내시경", "필요 시 CT PNS"] },
      { id: "mmt", name: "최대 약물치료", when: "4~12주", next: "4주", todo: ["비강 스테로이드 + 식염수 세척", "제2형 아니면 저용량 마크롤라이드 선택적"] },
      {
        id: "reassess", name: "재평가·CT", when: "약물 후", next: "2주", todo: ["증상·내시경 반응", "CT PNS"],
        decide: { q: "약물 반응?", options: [{ label: "조절됨", to: "maintain" }, { label: "지속 + CT 이상", to: "decide" }] },
      },
      {
        id: "decide", name: "수술 결정", when: "", next: "2주", todo: ["ESS 설명·동의", "수술 전 검사"],
        decide: { q: "수술?", options: [{ label: "ESS", to: "surgery" }, { label: "약물 지속", to: "maintain" }] },
      },
      { id: "surgery", name: "수술 (ESS)", when: "", next: "1주", todo: [] },
      { id: "po_early", name: "술후 1~2주", when: "1~2주", next: "4주", todo: ["세척·가피 제거"] },
      { id: "po_1_6m", name: "술후 1·3·6개월", when: "1·3·6개월", next: "3개월", todo: ["내시경(유착·재발)", "비강 스테로이드 지속"] },
      {
        id: "po_1y", name: "술후 1년", when: "1년", next: "6개월", todo: ["내시경"],
        decide: { q: "재발?", options: [{ label: "없음 → 종결", to: "end" }, { label: "재발 → 약물", to: "mmt" }] },
      },
      { id: "maintain", name: "약물 유지·경과", when: "3~6개월", next: "3개월", todo: ["비강 스테로이드·세척 지속", "악화 시 재평가"] },
      { id: "end", name: "종결", when: "", todo: ["증상 시 재방문"] },
    ],
  },
  {
    id: "crs_t2",
    name: "제2형 만성 부비동염 (용종·호산구성)",
    maxFollow: "장기(수년 이상, 재발 감시)",
    stages: [
      { id: "eval", name: "초진 평가", when: "초진", next: "4주", todo: ["내시경 용종 점수", "혈중 호산구·IgE", "천식·NSAID 과민 확인", "CT PNS"] },
      { id: "mmt", name: "최대 약물치료", when: "4~12주", next: "4주", todo: ["비강 스테로이드", "단기 경구 스테로이드(1년 1~2회 이내)"] },
      {
        id: "reassess", name: "재평가", when: "약물 후", next: "2주", todo: ["증상·내시경 반응"],
        decide: { q: "조절?", options: [{ label: "조절됨", to: "maintain" }, { label: "조절 안 됨", to: "decide" }] },
      },
      {
        id: "decide", name: "수술 결정", when: "", next: "2주", todo: ["ESS 설명·동의", "수술 전 검사"],
        decide: { q: "수술?", options: [{ label: "ESS", to: "surgery" }, { label: "생물학적 제제 먼저(기준 충족 시)", to: "biologic" }] },
      },
      { id: "surgery", name: "수술 (ESS)", when: "", next: "1주", todo: [] },
      { id: "po_early", name: "술후 1~2주", when: "1~2주", next: "4주", todo: ["세척·가피 제거"] },
      {
        id: "po_follow", name: "술후 1·3·6개월·1년", when: "1·3·6개월·1년", next: "3개월", todo: ["내시경 재발 감시", "비강 스테로이드 지속"],
        decide: { q: "수술 후 조절?", options: [{ label: "조절됨", to: "maintain" }, { label: "재발·조절 안 됨 → 생물학적 제제 기준 확인", to: "biologic" }] },
      },
      {
        id: "biologic", name: "생물학적 제제", when: "6개월 반응 평가, 이후 매년", next: "3개월",
        todo: ["EPOS 기준(5개 중 3개, 혈중 호산구 150/μL) 확인", "6개월 반응 평가"],
        decide: { q: "6개월 반응?", options: [{ label: "반응 → 지속·매년 평가", to: "maintain" }, { label: "무반응 → 중단·재평가", to: "decide" }] },
      },
      { id: "maintain", name: "장기 관리", when: "3~6개월", next: "3개월", todo: ["재발 감시", "비강 스테로이드 지속"] },
    ],
  },
  {
    id: "ar",
    name: "알레르기 비염",
    maxFollow: "증상 조절되면 필요 시 방문",
    stages: [
      { id: "eval", name: "초진 평가", when: "초진", next: "4주", todo: ["증상(계절성·통년성)", "알레르기 검사(MAST·피부반응)"] },
      { id: "med", name: "약물치료", when: "4주", next: "4주", todo: ["비강 항히스타민 + 스테로이드 병합"] },
      {
        id: "reassess", name: "4주 반응 평가", when: "4주", next: "4주", todo: ["증상 조절 정도"],
        decide: { q: "조절?", options: [{ label: "조절됨", to: "prn" }, { label: "불충분 → 약 조정", to: "step_up" }, { label: "면역치료", to: "immuno" }] },
      },
      { id: "step_up", name: "약 조정", when: "4주", next: "4주", todo: ["병합 조정·몬테루카스트 등", "면역치료 고려"] },
      { id: "immuno", name: "면역치료", when: "3~5년", next: "3개월", todo: ["순응도·반응 평가"] },
      { id: "prn", name: "필요 시 방문", when: "", todo: ["계절성은 계절 시작 전 시작"] },
    ],
  },
  {
    id: "olf",
    name: "후각저하 (감염 후)",
    maxFollow: "보통 2년(그 사이 회복 가능)",
    stages: [
      { id: "eval", name: "초진 평가", when: "초진", next: "3개월", todo: ["원인 감별: 내시경, 필요 시 CT·MRI", "후각검사(KVSS·YOF)"] },
      { id: "training", name: "후각 훈련", when: "12주", next: "3개월", todo: ["4가지 냄새 하루 2회", "비강 스테로이드"] },
      {
        id: "reassess", name: "3개월 재평가", when: "3개월", next: "3개월", todo: ["후각검사 재검"],
        decide: { q: "회복?", options: [{ label: "회복 → 종결", to: "end" }, { label: "일부·없음 → 훈련 계속", to: "long" }] },
      },
      { id: "long", name: "훈련 지속·재평가", when: "3~6개월마다, 최장 2년", next: "3개월", todo: ["후각검사 재검"] },
      { id: "end", name: "종결", when: "", todo: [] },
    ],
  },
  {
    id: "ip",
    name: "내번성 유두종",
    maxFollow: "최소 5년, 장기(평생) 권장",
    stages: [
      { id: "eval", name: "진단", when: "초진", next: "2주", todo: ["내시경", "CT + MRI(기시부)", "조직검사"] },
      { id: "surgery", name: "수술", when: "", next: "1주", todo: ["기시부 완전 제거"] },
      { id: "po_early", name: "술후 1~2주", when: "1~2주", next: "4주", todo: ["세척·가피 제거", "조직 결과(이형성·악성)"] },
      {
        id: "surv_2y", name: "첫 2년 감시", when: "3~6개월 간격", next: "3개월", todo: ["내시경"],
        decide: { q: "재발·이형성 의심?", options: [{ label: "없음", to: "surv_annual" }, { label: "의심 → MRI·조직검사", to: "eval" }] },
      },
      { id: "surv_annual", name: "매년 감시", when: "매년(최소 5년)", next: "6개월", todo: ["내시경", "의심 시 MRI·조직검사"] },
    ],
  },
  {
    id: "osa",
    name: "폐쇄성 수면무호흡",
    maxFollow: "치료 반응 확인 후 1년마다",
    stages: [
      { id: "eval", name: "초진 평가", when: "초진", next: "4주", todo: ["코골이·주간졸림", "신체검사(코·구인두)", "수면다원검사(PSG)"] },
      {
        id: "decide", name: "치료 결정", when: "PSG 후", next: "4주", todo: ["중증도 설명"],
        decide: { q: "치료?", options: [{ label: "CPAP", to: "cpap" }, { label: "수술", to: "surgery" }, { label: "체중·구강장치", to: "annual" }] },
      },
      { id: "cpap", name: "CPAP", when: "1~3개월", next: "2개월", todo: ["순응도 확인"] },
      { id: "surgery", name: "수술", when: "", next: "2주", todo: [] },
      { id: "po", name: "술후 3~6개월", when: "3~6개월", next: "3개월", todo: ["PSG 재검"] },
      { id: "annual", name: "매년 확인", when: "1년", next: "6개월", todo: ["증상·체중"] },
    ],
  },
  {
    id: "epistaxis",
    name: "반복 코피",
    maxFollow: "재발 없으면 종결",
    stages: [
      { id: "eval", name: "초진 평가", when: "초진", next: "2주", todo: ["출혈 부위", "항응고제·혈압 확인"] },
      { id: "treat", name: "처치", when: "", next: "2주", todo: ["소작·연고"] },
      {
        id: "check", name: "재발 확인", when: "2~4주", next: "4주", todo: ["재발 여부"],
        decide: { q: "재발?", options: [{ label: "없음 → 종결", to: "end" }, { label: "반복 → 내시경·혈액검사", to: "workup" }] },
      },
      { id: "workup", name: "추가 검사", when: "", next: "2주", todo: ["내시경", "혈액검사(응고)"] },
      { id: "end", name: "종결", when: "", todo: [] },
    ],
  },
  {
    id: "mass",
    name: "비강·부비동 종물",
    maxFollow: "조직 결과에 따라",
    stages: [
      { id: "eval", name: "초진 평가", when: "초진", next: "2주", todo: ["내시경", "CT·MRI"] },
      {
        id: "biopsy", name: "조직검사", when: "", next: "2주", todo: ["조직검사"],
        decide: {
          q: "조직 결과?",
          options: [
            { label: "내번성 유두종", note: "→ 내번성 유두종 경로" },
            { label: "염증성 → 부비동염 경로", note: "→ 만성 부비동염 경로" },
            { label: "악성 → 치료 계획·의뢰", to: "malignant" },
            { label: "미확정 → 3개월 이내 재평가", to: "reassess" },
          ],
        },
      },
      { id: "reassess", name: "재평가", when: "3개월 이내", next: "3개월", todo: ["내시경·영상"] },
      { id: "malignant", name: "악성 — 치료·의뢰", when: "", todo: ["병기·치료 계획"] },
    ],
  },
];

export const pathwayById = (id: string) => PATHWAYS.find((p) => p.id === id);
export const stageOf = (p: Pathway, id: string | null | undefined) => p.stages.find((s) => s.id === id);

// 갈림길·단계 확정이 Plan(외래 명단·도우미의 수술/약물치료/경과관찰)도 같이 정한다. 평가·결정 단계는 Plan을 건드리지 않음
const PLAN_BY_STAGE: Record<string, "surgery" | "medication" | "observation"> = {
  surgery: "surgery",
  med: "medication", mmt: "medication", maintain: "medication", training: "medication", long: "medication",
  biologic: "medication", immuno: "medication", step_up: "medication", cpap: "medication", treat: "medication",
  po1: "observation", po2: "observation", po3: "observation", po: "observation", po_early: "observation", po_1_6m: "observation",
  po_1y: "observation", po_follow: "observation", surv_2y: "observation", surv_annual: "observation", annual: "observation",
  prn: "observation", check: "observation", end: "observation",
};
export const planOfStage = (stageId: string) => PLAN_BY_STAGE[stageId] ?? null;

// 로드맵 글의 "요약:" 한 줄(AI) — 진료실 프로그램 작성 탭 맨 위에 보인다
export function summaryLine(roadmapText: string | null | undefined): string | null {
  const m = /^\s*요약\s*:\s*(.+)$/m.exec(roadmapText ?? "");
  return m ? m[1].trim() : null;
}

// AI 출력의 경로 줄 — 로드맵 글에서 떼어 구조로 저장한다(나머지 글은 그대로 로드맵)
//  [경로] crs_t2 = mmt | 근거
//  [외래] 2026-08-14 | crs_t2:eval | 그 외래 요약
export type PathwayProposal = { pathwayId: string; stageId: string; reason: string };
export type VisitLine = { date: string; pathwayId: string | null; stageId: string | null; summary: string };

export function parsePathwayLines(text: string): { rest: string; pathways: PathwayProposal[]; visits: VisitLine[] } {
  const pathways: PathwayProposal[] = [];
  const visits: VisitLine[] = [];
  const rest: string[] = [];
  for (const line of text.split("\n")) {
    const p = /^\s*\[경로\]\s*([a-z0-9_]+)\s*=\s*([a-z0-9_]+)\s*(?:\|\s*(.*))?$/.exec(line);
    if (p) {
      const pw = pathwayById(p[1]);
      if (pw && stageOf(pw, p[2]) && pathways.length < 2 && !pathways.some((x) => x.pathwayId === p[1]))
        pathways.push({ pathwayId: p[1], stageId: p[2], reason: (p[3] ?? "").trim().slice(0, 300) });
      continue;
    }
    const v = /^\s*\[외래\]\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(?:([a-z0-9_]+):([a-z0-9_]+))?\s*\|\s*(.+)$/.exec(line);
    if (v) {
      const pw = v[2] ? pathwayById(v[2]) : undefined;
      const ok = pw && stageOf(pw, v[3]);
      if (visits.length < 40) visits.push({ date: v[1], pathwayId: ok ? v[2] : null, stageId: ok ? v[3] : null, summary: v[4].trim().slice(0, 600) });
      continue;
    }
    rest.push(line);
  }
  return { rest: rest.join("\n").replace(/\n{3,}/g, "\n\n").trim(), pathways, visits };
}

// 지금 단계 다음 이력 — 같은 단계면 쌓지 않는다
export type StageEvent = { stageId: string; date: string; by: "ai" | "doctor" };
export function pushHistory(history: StageEvent[], ev: StageEvent): StageEvent[] {
  const last = history[history.length - 1];
  return last && last.stageId === ev.stageId ? history : [...history, ev].slice(-50);
}

export function parseHistory(v: unknown): StageEvent[] {
  return Array.isArray(v)
    ? v.filter((e): e is StageEvent => !!e && typeof e === "object" && typeof (e as StageEvent).stageId === "string" && typeof (e as StageEvent).date === "string")
    : [];
}

// AI 제안 반영 규칙: 의사가 확정한 경로는 단계를 바꾸지 않고 제안만 남긴다. 확정 전이면 AI 단계로 바로 바꾼다(제안 표시)
export function applyProposal(
  cur: { stageId: string; confirmed: boolean; history: StageEvent[] } | null,
  prop: PathwayProposal,
  date: string,
): { stageId: string; confirmed: boolean; proposedStageId: string | null; proposedReason: string | null; history: StageEvent[] } {
  if (!cur) return { stageId: prop.stageId, confirmed: false, proposedStageId: null, proposedReason: prop.reason || null, history: [{ stageId: prop.stageId, date, by: "ai" }] };
  if (cur.confirmed)
    return {
      stageId: cur.stageId,
      confirmed: true,
      proposedStageId: prop.stageId === cur.stageId ? null : prop.stageId,
      proposedReason: prop.stageId === cur.stageId ? null : prop.reason || null,
      history: cur.history,
    };
  return { stageId: prop.stageId, confirmed: false, proposedStageId: null, proposedReason: prop.reason || null, history: pushHistory(cur.history, { stageId: prop.stageId, date, by: "ai" }) };
}

export const SetStageSchema = z.object({
  chartNo: z.string().trim().regex(/^\d{4,12}$/),
  pathwayId: z.string().refine((id) => !!pathwayById(id)),
  stageId: z.string(),
}).refine((v) => !!stageOf(pathwayById(v.pathwayId)!, v.stageId), { message: "단계가 없습니다." });

// 진료실 프로그램용 글(한 경로 몇 줄): 단계 줄(✓ 지난·● 지금), 지금 단계 할 일·다음 외래 권장·갈림길, AI 제안
export function pathwayText(pp: { pathwayId: string; stageId: string; confirmed: boolean; proposedStageId: string | null; history: { stageId: string }[] }): string {
  const def = pathwayById(pp.pathwayId);
  if (!def) return "";
  const passed = new Set(pp.history.map((h) => h.stageId).filter((s) => s !== pp.stageId));
  const cur = stageOf(def, pp.stageId);
  const lines = [
    `${def.name}${pp.confirmed ? "" : " (AI 제안)"}`,
    def.stages.map((s) => (s.id === pp.stageId ? `●${s.name}` : passed.has(s.id) ? `✓${s.name}` : s.name)).join(" → "),
  ];
  if (cur) {
    lines.push(`지금: ${cur.name}${cur.when ? ` (${cur.when})` : ""}${cur.next ? ` · 다음 외래 권장 ${cur.next}` : ""}`);
    if (cur.todo.length) lines.push(`할 일: ${cur.todo.join(" · ")}`);
    if (cur.decide) lines.push(`◆ ${cur.decide.q} ${cur.decide.options.map((o) => `[${o.label}]`).join(" ")}`);
  }
  const prop = stageOf(def, pp.proposedStageId);
  if (prop) lines.push(`AI 제안: ${prop.name}로 이동`);
  return lines.join("\n");
}

// AI 질문에 넣는 경로 목록(id와 단계 id만)
export function pathwayPromptList(): string {
  return PATHWAYS.map((p) => `${p.id} (${p.name}): ${p.stages.map((s) => `${s.id}=${s.name}`).join(", ")}`).join("\n");
}
