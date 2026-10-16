// 차트(EMR) remark 칸에 그대로 붙여넣을 한 문장(사용자 요청 형식, 2026-10-16):
//   "코막힘, 후비루 증상 있어 10월 16일 Septoturbinoplasty + Both ESS 시행함, silastic sheet insertion 함,
//    1주일~10일 사이에 silastic sheet 제거해야함, (특이사항)."
// 비어 있는 부분은 문장에서 뺀다. 여러 줄로 적은 특이사항은 문장 다음 줄부터 그대로 붙인다.
export function buildRemarkText({
  chiefComplaint,
  surgeryDate,
  procedureName,
  postOpRemark,
  extras = [],
}: {
  chiefComplaint?: string;
  surgeryDate?: string;
  procedureName?: string;
  postOpRemark?: string;
  // 체크 항목에서 나온 덧붙임(예: "silastic sheet insertion 함") — remarkExtras로 만든다
  extras?: string[];
}): string {
  const cc = chiefComplaint?.trim();
  const date = remarkDate(surgeryDate);
  const op = [date, procedureName?.trim()].filter(Boolean).join(" ");
  const remark = postOpRemark?.trim() ?? "";
  const multiLine = remark.includes("\n");

  const parts: string[] = [];
  if (op) parts.push(`${cc ? `${cc} 증상 있어 ` : ""}${op} 시행함`);
  else if (cc) parts.push(`${cc} 증상`);
  parts.push(...extras);
  if (remark && !multiLine) parts.push(remark);
  const sentence = parts.length ? `${parts.join(", ").replace(/[.\s]+$/, "")}.` : "";
  return multiLine ? [sentence, remark].filter(Boolean).join("\n") : sentence;
}

// "2026-10-16" → "10월 16일"(형식이 다르면 그대로)
function remarkDate(date?: string): string {
  const d = date?.trim() ?? "";
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : d;
}

// 기록지 값에서 remark에 덧붙일 항목 — Silastic sheet(ESS) 또는 비중격 silastic splint를 넣었으면
// 넣었다는 것과 제거 시기를 남긴다(사용자 2026-10-16).
export function remarkExtras(values: Record<string, unknown> | null | undefined): string[] {
  return values?.f_silastic_sheet === true || values?.s_splint === true
    ? ["silastic sheet insertion 함", "1주일~10일 사이에 silastic sheet 제거해야함"]
    : [];
}

// CC 빠른 입력용 증상 목록 — side가 true인 증상은 방향(Rt./Lt./Both)을 붙일 수 있다.
export const CC_SYMPTOMS: { label: string; side: boolean }[] = [
  { label: "코막힘", side: true },
  { label: "콧물", side: true },
  { label: "후비루", side: false },
  { label: "후각저하", side: false },
  { label: "안면통", side: true },
  { label: "두통", side: false },
  { label: "비출혈", side: true },
  { label: "코골이", side: false },
  { label: "재채기", side: false },
  { label: "Foul odor", side: true },
];

export const CC_SIDES = ["Rt.", "Lt.", "Both"] as const;
export type CcSide = (typeof CC_SIDES)[number];

function splitCc(cc: string): string[] {
  return cc
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// "코막힘 (Rt.)" → { name: "코막힘", side: "Rt." }
function parseCcItem(item: string): { name: string; side?: string } {
  const m = item.match(/^(.*?)\s*\(([^()]*)\)$/);
  return m ? { name: m[1].trim(), side: m[2].trim() } : { name: item };
}

// CC 문자열에서 이 증상이 어떤 방향으로 들어가 있는지 — 없으면 undefined, 방향 없이
// 들어가 있으면 "".
export function ccSymptomSide(cc: string, symptom: string): string | undefined {
  for (const item of splitCc(cc)) {
    const { name, side } = parseCcItem(item);
    if (name === symptom) return side ?? "";
  }
  return undefined;
}

// 증상을 뺀다(없으면 그대로). 직접 적은 다른 내용은 건드리지 않는다.
export function removeCcSymptom(cc: string, symptom: string): string {
  return splitCc(cc)
    .filter((item) => parseCcItem(item).name !== symptom)
    .join(", ");
}

// 이미 들어간 증상의 방향만 바꾼다 — side가 없으면 방향 표시를 지운다. 없는 증상이면 붙인다.
export function setCcSymptomSide(cc: string, symptom: string, side?: string): string {
  const items = splitCc(cc);
  const next = side ? `${symptom} (${side})` : symptom;
  const index = items.findIndex((item) => parseCcItem(item).name === symptom);
  if (index === -1) return [...items, next].join(", ");
  return items.map((item, i) => (i === index ? next : item)).join(", ");
}

// 증상 버튼을 눌렀을 때 CC 문자열을 고친다. 같은 증상이 같은 방향으로 이미 있으면
// 빼고(토글), 방향만 다르면 그 자리에서 방향만 바꾸고, 없으면 맨 뒤에 붙인다.
// 사용자가 직접 적은 다른 내용은 건드리지 않는다.
export function toggleCcSymptom(cc: string, symptom: string, side?: string): string {
  const items = splitCc(cc);
  const next = side ? `${symptom} (${side})` : symptom;
  const index = items.findIndex((item) => parseCcItem(item).name === symptom);
  if (index === -1) return [...items, next].join(", ");
  if (items[index] === next) return items.filter((_, i) => i !== index).join(", ");
  return items.map((item, i) => (i === index ? next : item)).join(", ");
}

// Silastic 제거 리마인더 제목 — 이미 만들었는지 확인할 때도 같은 값을 쓴다("use server" 파일엔 상수를 못 둬서 여기에)
export const SILASTIC_REMINDER_TITLE = "Silastic sheet 제거";
