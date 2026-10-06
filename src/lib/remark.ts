// 차트(EMR) remark 칸에 그대로 붙여넣을 수 있게 CC(주호소) · 수술명 · 수술 후
// 특이사항을 한 덩어리로 묶는다. 비어 있는 항목은 줄째로 뺀다 — "CC : " 처럼
// 빈 칸이 남아 있으면 붙여넣은 뒤 매번 지워야 해서.
export function buildRemarkText({
  chiefComplaint,
  surgeryDate,
  procedureName,
  postOpRemark,
}: {
  chiefComplaint?: string;
  surgeryDate?: string;
  procedureName?: string;
  postOpRemark?: string;
}): string {
  const lines: string[] = [];
  const cc = chiefComplaint?.trim();
  if (cc) lines.push(`CC : ${cc}`);
  const op = [surgeryDate?.trim(), procedureName?.trim()].filter(Boolean).join(" ");
  if (op) lines.push(`Op : ${op}`);
  const remark = postOpRemark?.trim();
  if (remark) {
    // 여러 줄로 적은 특이사항은 머리말 다음 줄부터 그대로 이어 붙인다.
    lines.push(remark.includes("\n") ? `수술 후 특이사항 :\n${remark}` : `수술 후 특이사항 : ${remark}`);
  }
  return lines.join("\n");
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
