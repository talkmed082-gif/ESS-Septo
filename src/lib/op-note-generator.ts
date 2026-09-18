import type { FieldValues } from "./field-types";
import { fessStepFieldKeys, fessStepLabels, type BuiltInSurgeryCode } from "./op-note-defs";

export type OpNoteMode = "plan" | "record";

export interface OpNoteResult {
  findings: string;
  procedureDetail: string;
}

function str(values: FieldValues, key: string, fallback = ""): string {
  const v = values[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function bool(values: FieldValues, key: string): boolean {
  return values[key] === true;
}

function numberSteps(steps: (string | false | undefined)[], startAt = 1): string {
  let n = startAt;
  return steps
    .filter((s): s is string => Boolean(s))
    .map((s) => `${n++}. ${s}`)
    .join("\n");
}

const anesthesiaLabels: Record<string, string> = {
  General: "전신마취",
  Local: "국소마취",
  MAC: "MAC",
};

export function anesthesiaLabel(anesthesiaType: string | undefined): string {
  if (!anesthesiaType) return "전신마취";
  return anesthesiaLabels[anesthesiaType] ?? anesthesiaType;
}

// ---------- 비강 소견 (공통) ----------

// 비중격 편위 방향/정도 — 예전엔 아래 nasalFindingsText 문장 속에 녹여서 길게
// 서술했으나, 기록지 내용이 장황해져서 맨 앞에 짧은 한 줄로 요약해 붙임
function septumSummaryLine(values: FieldValues): string {
  const side = str(values, "n_dev_side", "특이 만곡 없음");
  const dev = str(values, "n_deviation", "해당없음");
  return side === "특이 만곡 없음" || dev === "해당없음"
    ? "비중격: 특이 편위 없음"
    : `비중격: ${side} ${dev} 편위`;
}

// 비용종 — 방향(n_polyp_side)을 먼저 고르고, 방향이 "없음"이 아닐 때만
// 위치(n_polyp_site_*)를 고르는 2단계 구조. 위치는 방향에 상관없이 공통 목록으로 둠
// (좌/우 위치를 각각 다르게 기록해야 하는 드문 경우는 자유 텍스트로 보정).
const polypSiteFields: { key: string; label: string }[] = [
  { key: "n_polyp_site_mm", label: "중비도" },
  { key: "n_polyp_site_ethmoid", label: "사골동" },
  { key: "n_polyp_site_maxillary", label: "상악동 자연공" },
  { key: "n_polyp_site_sphenoid", label: "접형동" },
  { key: "n_polyp_site_choana", label: "후비공까지 연장" },
];

function polypSites(values: FieldValues): string[] {
  return polypSiteFields.filter((f) => bool(values, f.key)).map((f) => f.label);
}

function hasPolyp(values: FieldValues): boolean {
  const side = str(values, "n_polyp_side", "없음");
  return side !== "없음" && polypSites(values).length > 0;
}

function skullBaseSentence(values: FieldValues): string {
  const left = str(values, "skull_base_left", "");
  const right = str(values, "skull_base_right", "");
  if (!left && !right) return "";

  if (left && right && left === right) {
    return ` 술전 CT상 skull base 높이는 양측 ${left} 소견.`;
  }
  const parts: string[] = [];
  if (right) parts.push(`우측 ${right}`);
  if (left) parts.push(`좌측 ${left}`);
  return ` 술전 CT상 skull base 높이는 ${parts.join(", ")} 소견.`;
}

// Uncinate process attachment — skull base/CT 소견과 같은 좌우 비교 문장 형식
function uncinateSentence(values: FieldValues): string {
  const left = str(values, "n_uncinate_left", "");
  const right = str(values, "n_uncinate_right", "");
  if (!left && !right) return "";

  if (left && right && left === right) {
    return ` Uncinate process attachment: 양측 ${left}.`;
  }
  const parts: string[] = [];
  if (right) parts.push(`우측 ${right}`);
  if (left) parts.push(`좌측 ${left}`);
  return ` Uncinate process attachment: ${parts.join(", ")}.`;
}

// CHR/Onodi/Haller/Agger nasi/Paradoxical MT처럼 "없음/우측/좌측/양측" 형태를
// 공유하는 소견들의 공통 문장 생성기
function sidedFindingSentence(label: string, key: string, values: FieldValues): string {
  const v = str(values, key, "없음");
  if (!v || v === "없음") return "";
  return ` ${label}: ${v}.`;
}

// 시신경/경동맥 골 결손 — 수술 중 손상 위험과 직결되는 소견이라 주의 문구를 덧붙임
function dehiscenceSentence(values: FieldValues): string {
  const v = str(values, "n_dehiscence", "없음");
  if (!v || v === "없음") return "";
  return ` 시신경/경동맥 골 결손(dehiscence): ${v} — 수술 중 주의 필요.`;
}

// 비강 소견 — 내시경 소견과 술전 CT 소견을 함께 서술함 (한쪽 검사로 국한하지 않음)
// 맨 앞에 비중격 편위를 짧은 한 줄로 요약하고, 나머지도 문장 대신 간결한 항목 나열로 구성
export function nasalFindingsText(values: FieldValues): string {
  const cb = str(values, "n_cb", "없음");
  const cbText =
    cb === "없음" ? "Concha bullosa 없음" : cb === "양측" ? "양측 concha bullosa" : `${cb} concha bullosa`;
  const polypText = hasPolyp(values)
    ? `비용종: ${str(values, "n_polyp_side")} ${polypSites(values).join(", ")}`
    : "비용종 없음";

  return (
    [septumSummaryLine(values), cbText, polypText].join(". ") +
    "." +
    skullBaseSentence(values) +
    uncinateSentence(values) +
    sidedFindingSentence("하비갑개 비후(CHR)", "n_chr", values) +
    sidedFindingSentence("Onodi cell", "n_onodi", values) +
    sidedFindingSentence("Haller cell", "n_haller", values) +
    sidedFindingSentence("Agger nasi cell", "n_agger_nasi", values) +
    sidedFindingSentence("Paradoxical middle turbinate", "n_paradoxical_mt", values) +
    dehiscenceSentence(values)
  );
}

function hasPolypAt(sideName: "좌측" | "우측", values: FieldValues): boolean {
  if (!hasPolyp(values)) return false;
  const side = str(values, "n_polyp_side", "없음");
  return side === "양측" || side === sideName;
}

// ---------- Turbinoplasty (비중격교정술/FESS 공통) ----------

const turbinateFields: { key: string; side: "좌측" | "우측"; label: string }[] = [
  { key: "turb_middle_right", side: "우측", label: "중비갑개" },
  { key: "turb_inferior_right", side: "우측", label: "하비갑개" },
  { key: "turb_middle_left", side: "좌측", label: "중비갑개" },
  { key: "turb_inferior_left", side: "좌측", label: "하비갑개" },
];

function turbinateLabelsForSide(side: "좌측" | "우측", values: FieldValues): string[] {
  return turbinateFields.filter((f) => f.side === side && bool(values, f.key)).map((f) => f.label);
}

function allTurbinateItems(values: FieldValues): string[] {
  return turbinateFields.filter((f) => bool(values, f.key)).map((f) => `${f.side} ${f.label}`);
}

// ---------- 비중격교정술 ----------

const incisionNames: Record<string, string> = {
  "Killian incision":
    "Killian incision을 시행한 후 mucoperichondrial flap 및 mucoperiosteal flap을 양측으로 거상함",
  "Hemitransfixion incision":
    "Hemitransfixion incision을 시행한 후 편측 mucoperichondrial flap을 거상하고 반대측은 tunneling을 통해 flap을 거상함",
  "Full transfixion incision":
    "Full transfixion incision을 시행하여 caudal end 전방까지 노출시킨 후 양측 mucoperichondrial flap을 거상함",
  "Cottle incision (maxilla-premaxillary)":
    "Cottle incision(maxilla-premaxillary approach)을 시행한 후 양측 mucoperichondrial 및 mucoperiosteal flap을 거상함",
};

function incisionSentence(values: FieldValues): string {
  const incision = str(values, "s_incision", "Hemitransfixion incision");
  const side = str(values, "s_incision_side", "");
  const base = incisionNames[incision] ?? incisionNames["Killian incision"];
  return side ? `${side}에서 ${base}` : base;
}

function septoCore(values: FieldValues): string[] {
  const caudal = bool(values, "s_caudal");
  const spur = bool(values, "s_spur");
  const turbItems = allTurbinateItems(values);
  const debrider = bool(values, "s_debrider");
  const splint = bool(values, "s_splint");
  const quiltingSuture = str(values, "s_quilting_suture", "4-0 chromic catgut");
  const splintSuture = str(values, "s_splint_suture", "4-0 nylon");

  const steps: (string | false)[] = [
    incisionSentence(values),
    caudal && "Caudal septum의 편위 부위에 대해 함께 교정을 시행함",
    spur && "골성 비중격(perpendicular plate of ethmoid, vomer)에서 bony spur를 확인하고 제거함",
    "확인된 편위 부위의 변형된 septal cartilage 및 골성 비중격 일부를 절제 및 교정하여 straightening 후 정중앙에 위치시킴",
    debrider && "Microdebrider를 이용하여 골성 및 연골성 비중격 조작을 보조적으로 시행함",
    turbItems.length > 0 && `${turbItems.join(", ")}에 대해 축소술(turbinoplasty)을 함께 시행함`,
    `Flap을 원위치로 정복한 후 ${quiltingSuture}를 사용하여 quilting suture 시행`,
    splint && `양측 비강에 silastic splint를 삽입하고 ${splintSuture}로 관통 봉합하여 고정함`,
  ];
  return steps.filter((s): s is string => Boolean(s));
}

function genSeptoplasty(values: FieldValues, mode: OpNoteMode, anesLabel: string): OpNoteResult {
  const pack = str(values, "s_pack", "Merocel");
  const localAnesthetic = str(values, "s_local_anesthetic", "1% lidocaine with epinephrine, 총 5cc");

  const steps: (string | false)[] = [];
  if (mode === "record") {
    steps.push(`환자를 앙와위로 눕히고 ${anesLabel} 하에 수술을 시작함`);
    steps.push(`${localAnesthetic}를 비중격 점막에 국소 침윤 마취함`);
  }
  steps.push(...septoCore(values));
  steps.push(`양측 비강에 ${pack} packing을 시행하고 출혈 소견 없음을 확인한 후 수술을 종료함`);

  return { findings: nasalFindingsText(values), procedureDetail: numberSteps(steps) };
}

// ---------- FESS ----------

const fessStepSentences: Record<(typeof fessStepFieldKeys)[number], string> = {
  mma: "Middle meatal antrostomy를 통해 상악동 자연공 확장",
  ant_eth: "Anterior ethmoidectomy 시행",
  post_eth: "Posterior ethmoidectomy 시행",
  sphenoid: "Sphenoidotomy 시행",
  frontal: "Frontal sinusotomy(Draf procedure) 시행",
};

function fessSideBlock(
  sideName: "좌측" | "우측",
  prefix: "f_left_" | "f_right_",
  debriderUsed: boolean,
  values: FieldValues,
): string[] {
  const selectedSteps = fessStepFieldKeys.filter((key) => bool(values, `${prefix}${key}`));
  const turbLabels = turbinateLabelsForSide(sideName, values);
  const silasticSheet = bool(values, `${prefix}silastic_sheet`);
  // 해당 측에 실제로 시행한 것이 하나도 없으면(반대측만 시행한 편측 FESS 등)
  // "수술을 진행함"이나 "비용종 제거함" 같은 문장이 생기지 않도록 블록 자체를 건너뜀
  if (selectedSteps.length === 0 && turbLabels.length === 0 && !silasticSheet) {
    return [];
  }

  const block: string[] = [`[${sideName}] 내시경(0°/30°)을 이용하여 수술을 진행함`];

  if (selectedSteps.length > 0) {
    // Uncinectomy는 FESS 진행 시 당연히 선행되는 조작이라 선택 항목에는 없지만
    // 기록지에는 항상 포함시킨다.
    block.push(`[${sideName}] Uncinectomy 시행`);
    for (const key of selectedSteps) {
      block.push(`[${sideName}] ${fessStepSentences[key]}`);
    }
    if (hasPolypAt(sideName, values)) {
      block.push(
        `[${sideName}] 관찰된 비용종은 ` +
          (debriderUsed ? "microdebrider를 이용하여" : "forceps를 이용하여 조심스럽게") +
          ` 제거함`,
      );
    }
  }

  if (turbLabels.length > 0) {
    block.push(`[${sideName}] ${turbLabels.join(", ")} 축소술(turbinoplasty) 시행`);
  }

  if (silasticSheet) {
    block.push(`[${sideName}] 유착 방지를 위해 middle meatus에 silastic sheet를 삽입함`);
  }

  return block;
}

function fessCore(values: FieldValues): string[] {
  const order = str(values, "f_side_order", "우측 먼저 → 좌측");
  const nav = bool(values, "f_nav");
  const debrider = bool(values, "f_debrider");

  const steps: string[] = [];
  if (nav) steps.push("Image-guided navigation system을 병용하여 해부학적 구조물을 확인함");

  const leftBlock = fessSideBlock("좌측", "f_left_", debrider, values);
  const rightBlock = fessSideBlock("우측", "f_right_", debrider, values);

  if (order === "좌측 먼저 → 우측") steps.push(...leftBlock, ...rightBlock);
  else steps.push(...rightBlock, ...leftBlock);

  return steps;
}

function genFess(values: FieldValues, mode: OpNoteMode, anesLabel: string): OpNoteResult {
  const pack = str(values, "f_pack", "Nasopore");

  const steps: (string | false)[] = [];
  if (mode === "record") {
    steps.push(`환자를 앙와위로 눕히고 ${anesLabel} 하에 수술을 시작함`);
    steps.push("Epinephrine을 적신 patty로 양측 비강 점막을 수축시킴");
  }
  steps.push(...fessCore(values));
  steps.push(`양측 수술 부위 지혈 상태를 확인한 후 ${pack} packing을 시행하고 수술을 종료함`);

  return { findings: nasalFindingsText(values), procedureDetail: numberSteps(steps) };
}

// ---------- 병행 (비중격교정술 + FESS) ----------

const comboOrderSequence: Record<string, ("septo" | "left" | "right")[]> = {
  "비중격 → 좌 FESS → 우 FESS": ["septo", "left", "right"],
  "비중격 → 우 FESS → 좌 FESS": ["septo", "right", "left"],
  "좌 FESS → 비중격 → 우 FESS": ["left", "septo", "right"],
  "우 FESS → 비중격 → 좌 FESS": ["right", "septo", "left"],
  "좌 FESS → 우 FESS → 비중격": ["left", "right", "septo"],
  "우 FESS → 좌 FESS → 비중격": ["right", "left", "septo"],
};

const comboBlockLabels: Record<"septo" | "left" | "right", string> = {
  septo: "비중격교정술",
  left: "FESS - 좌측",
  right: "FESS - 우측",
};

function genCombo(values: FieldValues, mode: OpNoteMode, anesLabel: string): OpNoteResult {
  const pack = str(values, "c_pack", "Nasopore");
  const nav = bool(values, "f_nav");
  const debrider = bool(values, "f_debrider");
  const order = str(values, "c_order", "비중격 → 우 FESS → 좌 FESS");

  const opening: string[] = [];
  if (mode === "record") {
    opening.push(`환자를 앙와위로 눕히고 ${anesLabel} 하에 수술을 시작함`);
    opening.push("Epinephrine을 함유한 국소마취제 및 patty를 이용하여 비중격 및 비강 점막에 국소 처치를 시행함");
  }
  if (nav) opening.push("Image-guided navigation system을 병용하여 해부학적 구조물을 확인함");

  const blocks: Record<"septo" | "left" | "right", string[]> = {
    septo: septoCore(values),
    left: fessSideBlock("좌측", "f_left_", debrider, values),
    right: fessSideBlock("우측", "f_right_", debrider, values),
  };
  const seq = comboOrderSequence[order] ?? comboOrderSequence["비중격 → 좌 FESS → 우 FESS"];

  let n = 1;
  const parts: string[] = [];
  if (opening.length > 0) {
    parts.push(numberSteps(opening, n));
    n += opening.length;
  }
  for (const key of seq) {
    if (blocks[key].length === 0) continue;
    parts.push(`--- ${comboBlockLabels[key]} ---`);
    parts.push(numberSteps(blocks[key], n));
    n += blocks[key].length;
  }
  parts.push("--- 종료 ---");
  parts.push(numberSteps([`양측 비강에 ${pack} packing을 시행하고 출혈 소견 없음을 확인한 후 수술을 종료함`], n));

  return { findings: nasalFindingsText(values), procedureDetail: parts.join("\n") };
}

export function generateOpNote(
  surgeryCode: BuiltInSurgeryCode,
  values: FieldValues,
  mode: OpNoteMode,
  anesthesiaType?: string,
): OpNoteResult {
  const anesLabel = anesthesiaLabel(anesthesiaType);
  if (surgeryCode === "SEPTOPLASTY") return genSeptoplasty(values, mode, anesLabel);
  if (surgeryCode === "ESS") return genFess(values, mode, anesLabel);
  return genCombo(values, mode, anesLabel);
}

// ---------- Op Plan 요약 (짧은 항목 나열 — 기록지의 서술형 문장과는 별도) ----------

function septoConciseItems(values: FieldValues, includePacking: boolean): string[] {
  const incision = str(values, "s_incision", "Hemitransfixion incision");
  const incisionSide = str(values, "s_incision_side", "");
  const items: (string | false)[] = [
    incisionSide ? `${incisionSide} ${incision}` : incision,
    bool(values, "s_caudal") && "Caudal septum 편위 교정",
    bool(values, "s_spur") && "Bony spur 제거",
    bool(values, "s_debrider") && "Microdebrider 사용",
    bool(values, "s_splint") && "Silastic splint 삽입",
  ];
  if (includePacking) items.push(`${str(values, "s_pack", "Merocel")} packing 예정`);
  return items.filter((s): s is string => Boolean(s));
}

function fessConciseSideLine(
  sideLabel: "좌측" | "우측",
  prefix: "f_left_" | "f_right_",
  values: FieldValues,
): string {
  const picked = fessStepFieldKeys
    .filter((k) => bool(values, `${prefix}${k}`))
    .map((k) => fessStepLabels[k]);
  if (bool(values, `${prefix}silastic_sheet`)) picked.push("Silastic sheet 삽입");
  return picked.length > 0 ? `${sideLabel}: ${picked.join(", ")}` : `${sideLabel}: 해당 없음`;
}

function fessConciseItems(values: FieldValues, includePacking: boolean): string[] {
  const items: string[] = [
    fessConciseSideLine("좌측", "f_left_", values),
    fessConciseSideLine("우측", "f_right_", values),
  ];
  if (bool(values, "f_nav")) items.push("Navigation(항법장치) 병용");
  if (includePacking) items.push(`${str(values, "f_pack", "Nasopore")} packing 예정`);
  return items;
}

function planItemsFor(surgeryCode: BuiltInSurgeryCode, values: FieldValues): string[] {
  const turbItems = allTurbinateItems(values);
  const turbLine = turbItems.length > 0 ? [`Turbinoplasty: ${turbItems.join(", ")}`] : [];

  if (surgeryCode === "SEPTOPLASTY") return [...septoConciseItems(values, true), ...turbLine];
  if (surgeryCode === "ESS") return [...fessConciseItems(values, true), ...turbLine];

  const order = str(values, "c_order", "비중격 → 우 FESS → 좌 FESS");
  return [
    `시행 순서: ${order}`,
    "[비중격교정술]",
    ...septoConciseItems(values, false).map((i) => `  - ${i}`),
    "[FESS]",
    ...fessConciseItems(values, false).map((i) => `  - ${i}`),
    ...turbLine,
    `공통 packing: ${str(values, "c_pack", "Nasopore")} 예정`,
  ];
}

export function generatePlanSummary(
  surgeryCode: BuiltInSurgeryCode,
  values: FieldValues,
  style: NameStyle = DEFAULT_NAME_STYLE,
): string {
  const procedureName = buildProcedureName(surgeryCode, values, style);
  const findings = nasalFindingsText(values);
  const items = planItemsFor(surgeryCode, values);
  const bulletList = items.map((i) => (i.startsWith("[") || i.startsWith("  -") ? i : `- ${i}`)).join("\n");
  return `수술명: ${procedureName}\n\n[비강 소견]\n${findings}\n\n[예정 술식]\n${bulletList}`;
}

// ---------- 수술명(Procedure name) 자동 생성 ----------

export type SideNotation = "full" | "paren" | "bracket";

export interface NameStyle {
  sideNotation: SideNotation;
  abbreviateRegions: boolean;
}

export const DEFAULT_NAME_STYLE: NameStyle = { sideNotation: "full", abbreviateRegions: false };

const fessRegionOrder = ["Frontal", "Ethmoid", "Maxillary", "Sphenoid"] as const;
const fessStepToRegion: Partial<Record<(typeof fessStepFieldKeys)[number], (typeof fessRegionOrder)[number]>> = {
  frontal: "Frontal",
  ant_eth: "Ethmoid",
  post_eth: "Ethmoid",
  mma: "Maxillary",
  sphenoid: "Sphenoid",
};

const regionAbbreviations: Record<(typeof fessRegionOrder)[number], string> = {
  Frontal: "F",
  Ethmoid: "E",
  Maxillary: "M",
  Sphenoid: "S",
};

function formatRegionList(regions: string[], style: NameStyle): string {
  if (style.abbreviateRegions) {
    return regions.map((r) => regionAbbreviations[r as (typeof fessRegionOrder)[number]]).join("");
  }
  return regions.join(", ");
}

function formatSideLabel(side: "R" | "L" | "B", style: NameStyle): string {
  if (style.sideNotation === "paren") return `${side})`;
  if (style.sideNotation === "bracket") return `${side}]`;
  return side === "R" ? "Rt." : side === "L" ? "Lt." : "Both";
}

function fessRegionsForSide(prefix: "f_left_" | "f_right_", values: FieldValues): string[] {
  const regions = new Set<string>();
  for (const key of fessStepFieldKeys) {
    if (bool(values, `${prefix}${key}`)) {
      const region = fessStepToRegion[key];
      if (region) regions.add(region);
    }
  }
  return fessRegionOrder.filter((r) => regions.has(r));
}

function buildFessProcedureName(values: FieldValues, label: string, style: NameStyle): string {
  const left = fessRegionsForSide("f_left_", values);
  const right = fessRegionsForSide("f_right_", values);

  if (left.length === 0 && right.length === 0) return label;

  const sameSet = left.length === right.length && left.every((r, i) => r === right[i]);
  if (left.length > 0 && right.length > 0 && sameSet) {
    return `${formatSideLabel("B", style)} ${label}(${formatRegionList(left, style)})`;
  }

  const parts: string[] = [];
  if (right.length > 0) parts.push(`${formatSideLabel("R", style)} ${label}(${formatRegionList(right, style)})`);
  if (left.length > 0) parts.push(`${formatSideLabel("L", style)} ${label}(${formatRegionList(left, style)})`);
  return parts.join(", ");
}

export function buildProcedureName(
  surgeryCode: BuiltInSurgeryCode,
  values: FieldValues,
  style: NameStyle = DEFAULT_NAME_STYLE,
): string {
  const turbSuffix = allTurbinateItems(values).length > 0 ? " + Turbinoplasty" : "";

  if (surgeryCode === "SEPTOPLASTY") return `Septoplasty${turbSuffix}`;
  if (surgeryCode === "ESS") return `${buildFessProcedureName(values, "ESS", style)}${turbSuffix}`;
  return `Septoplasty + ${buildFessProcedureName(values, "ESS", style)}${turbSuffix}`;
}

// ---------- Op Plan 표 형식 (인쇄용 — 내시경 앞에 붙여두고 한눈에 보는 용도) ----------

export interface PlanKeyValueRow {
  label: string;
  value: string;
}

export interface PlanSideMatrixRow {
  label: string;
  left: boolean;
  right: boolean;
}

export interface PlanTable {
  procedureName: string;
  findings: string;
  keyValueRows: PlanKeyValueRow[];
  sideMatrix?: { title: string; rows: PlanSideMatrixRow[] };
}

function fessSideMatrix(values: FieldValues): { title: string; rows: PlanSideMatrixRow[] } {
  return {
    title: "FESS 시행 부위",
    rows: [
      ...fessStepFieldKeys.map((k) => ({
        label: fessStepLabels[k],
        left: bool(values, `f_left_${k}`),
        right: bool(values, `f_right_${k}`),
      })),
      {
        label: "Silastic sheet 삽입",
        left: bool(values, "f_left_silastic_sheet"),
        right: bool(values, "f_right_silastic_sheet"),
      },
    ],
  };
}

export function buildPlanTable(
  surgeryCode: BuiltInSurgeryCode,
  values: FieldValues,
  style: NameStyle = DEFAULT_NAME_STYLE,
): PlanTable {
  const procedureName = buildProcedureName(surgeryCode, values, style);
  const findings = nasalFindingsText(values);
  const turbItems = allTurbinateItems(values);
  const turbRow: PlanKeyValueRow[] =
    turbItems.length > 0 ? [{ label: "Turbinoplasty", value: turbItems.join(", ") }] : [];

  if (surgeryCode === "SEPTOPLASTY") {
    const [incision, ...rest] = septoConciseItems(values, false);
    return {
      procedureName,
      findings,
      keyValueRows: [
        { label: "절개", value: incision },
        { label: "동반 술식", value: rest.length > 0 ? rest.join(", ") : "-" },
        ...turbRow,
        { label: "Packing", value: str(values, "s_pack", "Merocel") },
      ],
    };
  }

  if (surgeryCode === "ESS") {
    return {
      procedureName,
      findings,
      keyValueRows: [
        ...turbRow,
        { label: "Navigation", value: bool(values, "f_nav") ? "사용" : "미사용" },
        { label: "Packing", value: str(values, "f_pack", "Nasopore") },
      ],
      sideMatrix: fessSideMatrix(values),
    };
  }

  const [incision, ...rest] = septoConciseItems(values, false);
  return {
    procedureName,
    findings,
    keyValueRows: [
      { label: "시행 순서", value: str(values, "c_order", "비중격 → 우 FESS → 좌 FESS") },
      { label: "절개(비중격)", value: incision },
      { label: "동반 술식(비중격)", value: rest.length > 0 ? rest.join(", ") : "-" },
      ...turbRow,
      { label: "Packing(공통)", value: str(values, "c_pack", "Nasopore") },
    ],
    sideMatrix: fessSideMatrix(values),
  };
}
