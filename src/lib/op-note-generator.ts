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

const devSideText: Record<string, string> = {
  "특이 만곡 없음": "",
  좌측: "좌측으로 ",
  우측: "우측으로 ",
  "양측(C자형)": "양측(C자형)으로 ",
};

const devSeverityText: Record<string, string> = {
  해당없음: "특이 만곡 소견은 관찰되지 않았고",
  경도: "경도 편위되어 있었고",
  중등도: "중등도 편위되어 있었고",
  고도: "고도 편위되어 있었고",
};

const polypLocNames: Record<string, string> = {
  n_polyp_mm_left: "좌측 중비도",
  n_polyp_mm_right: "우측 중비도",
  n_polyp_ethmoid: "사골동 내",
  n_polyp_maxillary: "상악동 자연공 부위",
  n_polyp_sphenoid: "접형동 내",
  n_polyp_choana: "후비공까지 연장되어",
};

export function nasalFindingsText(values: FieldValues): string {
  const side = str(values, "n_dev_side", "특이 만곡 없음");
  const dev = str(values, "n_deviation", "해당없음");
  const cb = str(values, "n_cb", "없음");
  const polypKeys = Object.keys(polypLocNames).filter((k) => bool(values, k));

  let s = "비내시경 소견상 비중격은 ";
  s +=
    side === "특이 만곡 없음" || dev === "해당없음"
      ? `${devSeverityText["해당없음"]}, `
      : `${devSideText[side] ?? ""}${devSeverityText[dev] ?? devSeverityText["해당없음"]}, `;

  s +=
    cb === "없음"
      ? "concha bullosa 소견은 관찰되지 않음. "
      : cb === "양측"
        ? "양측 중비갑개에 concha bullosa 소견이 관찰됨. "
        : `${cb} 중비갑개에 concha bullosa 소견이 관찰됨. `;

  s +=
    polypKeys.length > 0
      ? `비용종은 ${polypKeys.map((k) => polypLocNames[k]).join(", ")}에서 관찰됨.`
      : "비용종 소견은 관찰되지 않음.";

  return s;
}

function hasPolypAt(sideName: "좌측" | "우측", values: FieldValues): boolean {
  const sideKey = sideName === "좌측" ? "n_polyp_mm_left" : "n_polyp_mm_right";
  const centralKeys = ["n_polyp_ethmoid", "n_polyp_maxillary", "n_polyp_sphenoid", "n_polyp_choana"];
  return bool(values, sideKey) || centralKeys.some((k) => bool(values, k));
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

function septoCore(values: FieldValues): string[] {
  const incision = str(values, "s_incision", "Hemitransfixion incision");
  const caudal = bool(values, "s_caudal");
  const spur = bool(values, "s_spur");
  const turb = bool(values, "s_turb");
  const debrider = bool(values, "s_debrider");
  const splint = bool(values, "s_splint");
  const quiltingSuture = str(values, "s_quilting_suture", "4-0 chromic catgut");
  const splintSuture = str(values, "s_splint_suture", "4-0 nylon");

  const steps: (string | false)[] = [
    incisionNames[incision] ?? incisionNames["Killian incision"],
    caudal && "Caudal septum의 편위 부위에 대해 함께 교정을 시행함",
    spur && "골성 비중격(perpendicular plate of ethmoid, vomer)에서 bony spur를 확인하고 제거함",
    "확인된 편위 부위의 변형된 septal cartilage 및 골성 비중격 일부를 절제 및 교정하여 straightening 후 정중앙에 위치시킴",
    debrider && "Microdebrider를 이용하여 골성 및 연골성 비중격 조작을 보조적으로 시행함",
    turb && "동반된 하비갑개 비후 소견에 대해 양측 하비갑개 점막하 절제술을 함께 시행함",
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
  uncinectomy: "Uncinectomy 시행",
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
  const block: string[] = [`[${sideName}] 내시경(0°/30°)을 이용하여 수술을 진행함`];
  for (const key of fessStepFieldKeys) {
    if (bool(values, `${prefix}${key}`)) {
      block.push(`[${sideName}] ${fessStepSentences[key]}`);
    }
  }
  if (hasPolypAt(sideName, values)) {
    block.push(
      `[${sideName}] 관찰된 비용종은 ` +
        (debriderUsed ? "microdebrider를 이용하여" : "forceps를 이용하여 조심스럽게") +
        ` 제거함`,
    );
  }
  return block;
}

function fessCore(values: FieldValues): string[] {
  const order = str(values, "f_side_order", "좌측 먼저 → 우측");
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
  const order = str(values, "c_order", "비중격 → 좌 FESS → 우 FESS");

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
  const items: (string | false)[] = [
    incision,
    bool(values, "s_caudal") && "Caudal septum 편위 교정",
    bool(values, "s_spur") && "Bony spur 제거",
    bool(values, "s_turb") && "하비갑개 축소술(SMR) 병행",
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
  if (surgeryCode === "SEPTOPLASTY") return septoConciseItems(values, true);
  if (surgeryCode === "ESS") return fessConciseItems(values, true);

  const order = str(values, "c_order", "비중격 → 좌 FESS → 우 FESS");
  return [
    `시행 순서: ${order}`,
    "[비중격교정술]",
    ...septoConciseItems(values, false).map((i) => `  - ${i}`),
    "[FESS]",
    ...fessConciseItems(values, false).map((i) => `  - ${i}`),
    `공통 packing: ${str(values, "c_pack", "Nasopore")} 예정`,
  ];
}

export function generatePlanSummary(surgeryCode: BuiltInSurgeryCode, values: FieldValues): string {
  const findings = nasalFindingsText(values);
  const items = planItemsFor(surgeryCode, values);
  const bulletList = items.map((i) => (i.startsWith("[") || i.startsWith("  -") ? i : `- ${i}`)).join("\n");
  return `[비강 소견]\n${findings}\n\n[예정 술식]\n${bulletList}`;
}
