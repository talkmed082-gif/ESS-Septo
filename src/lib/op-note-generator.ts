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

// 마취 유도 직후 항상 시행하는 국소 처치라 선택 항목 없이 기록지에 기본으로
// 포함시킨다. 주입 방향은 실제 수술 범위(편측/양측)에 맞춰 표기한다.
function sphenopalatineBlockSentence(sideLabel: string): string {
  return `${sideLabel} sphenopalatine foramen 부위에 epinephrine/lidocaine mixture를 주입하여 국소마취를 추가 시행함`;
}

// Dermacol은 packing 재료가 아니라 창상 회복을 돕는 보조제라, packing 시행
// 직후(기록지 맨 끝 직전)에 별도 문장으로 추가한다.
function dermacolSentence(values: FieldValues): string {
  return bool(values, "dermacol") ? "Dermacol을 수술 부위에 도포함" : "";
}

// Revision case(재수술)라는 사실을 기록지에도 남긴다.
function revisionSentence(values: FieldValues): string {
  return bool(values, "f_revision")
    ? "본 수술은 이전 수술 부위에 대한 Revision case로, 기존 수술 부위를 재평가하며 진행함"
    : "";
}

// ---------- 비강 소견 (공통) ----------

// 비중격 편위 방향/정도 — 예전엔 아래 nasalFindingsText 문장 속에 녹여서 길게
// 서술했으나, 기록지 내용이 장황해져서 맨 앞에 짧은 한 줄로 요약해 붙임
function septumSummaryLine(values: FieldValues): string {
  const side = str(values, "n_dev_side", "특이 만곡 없음");
  const dev = str(values, "n_deviation", "해당없음");
  const perforation = str(values, "n_septal_perforation", "없음") === "있음";
  const note = str(values, "n_septum_note", "");

  const parts: string[] = [
    side === "특이 만곡 없음" || dev === "해당없음" ? "특이 편위 없음" : `${side} ${dev} 편위`,
  ];
  if (perforation) parts.push("천공 있음");
  if (note) parts.push(note);

  return `비중격: ${parts.join(", ")}`;
}

// 비용종 — 좌/우 정도(위치)가 다른 경우가 많아 위치를 측별로 각각 고른다.
// 위치 체크박스가 하나라도 있으면 그 측에 비용종이 있는 것으로 본다
// (별도의 "방향" 선택 없이 위치 선택만으로 존재 여부까지 표현).
const polypSiteFields: { key: string; label: string }[] = [
  { key: "site_mm", label: "중비도" },
  { key: "site_ethmoid", label: "사골동" },
  { key: "site_maxillary", label: "상악동 자연공" },
  { key: "site_sphenoid", label: "접형동" },
  { key: "site_choana", label: "후비공까지 연장" },
];

function polypSideKeyPrefix(side: "좌측" | "우측"): string {
  return side === "우측" ? "n_polyp_right_" : "n_polyp_left_";
}

function polypSitesAt(side: "좌측" | "우측", values: FieldValues): string[] {
  const prefix = polypSideKeyPrefix(side);
  return polypSiteFields.filter((f) => bool(values, `${prefix}${f.key}`)).map((f) => f.label);
}

function hasPolypAt(sideName: "좌측" | "우측", values: FieldValues): boolean {
  return polypSitesAt(sideName, values).length > 0;
}

function hasPolyp(values: FieldValues): boolean {
  return hasPolypAt("우측", values) || hasPolypAt("좌측", values);
}

// 좌/우 위치가 다를 수 있어 측별로 괄호를 나눠 서술한다
function polypFindingText(values: FieldValues): string {
  const right = polypSitesAt("우측", values);
  const left = polypSitesAt("좌측", values);
  if (right.length === 0 && left.length === 0) return "비용종 없음";
  const parts: string[] = [];
  if (right.length > 0) parts.push(`우측(${right.join(", ")})`);
  if (left.length > 0) parts.push(`좌측(${left.join(", ")})`);
  return `비용종: ${parts.join(", ")}`;
}

// UP(Uncinate process) attachment — skull base/CT 소견과 같은 좌우 비교 문장 형식
function uncinateLine(values: FieldValues): string {
  const left = str(values, "n_uncinate_left", "");
  const right = str(values, "n_uncinate_right", "");
  if (!left && !right) return "";

  if (left && right && left === right) {
    return `UP attach: 양측 ${left}`;
  }
  const parts: string[] = [];
  if (right) parts.push(`우측 ${right}`);
  if (left) parts.push(`좌측 ${left}`);
  return `UP attach: ${parts.join(", ")}`;
}

// CHR처럼 "없음/우측/좌측/양측" 단일 선택 형태인 소견의 한 줄 서술
function sidedFindingLine(label: string, key: string, values: FieldValues): string {
  const v = str(values, key, "없음");
  if (!v || v === "없음") return "";
  return `${label}: ${v}`;
}

// Concha bullosa/skull base 위험/Onodi/Haller/골 결손처럼 "문제 있는지
// 체크 → 있으면 방향만 선택" 2단계 입력을 공유하는 소견들의 공통 한 줄 서술.
// 임상적 주의 문구는 넣지 않는다 — 실제 기록지 작성 시 의사가 직접 판단해서 쓴다.
function presentSidedLine(label: string, presentKey: string, sideKey: string, values: FieldValues): string {
  if (!bool(values, presentKey)) return "";
  const side = str(values, sideKey, "양측");
  return `${label}: ${side}`;
}

// 비강 소견 — 내시경 소견과 술전 CT 소견을 함께 서술함 (한쪽 검사로 국한하지 않음)
// Septoturbinoplasty P/E(n_septo_pe_done)와 ESS P/E(n_ess_pe_done) 체크
// 여부에 따라 각 그룹 내용을 포함할지 결정한다 — 체크 안 한 그룹은 값이
// 남아있어도 아예 서술하지 않는다(그 진찰을 기록하지 않았다는 뜻이므로).
// 소견을 한 문단에 몰아 쓰면 읽기 어려워서 소견 하나당 한 줄씩 나눠 보여준다.
export function nasalFindingsText(values: FieldValues): string {
  const lines: string[] = [];

  if (bool(values, "n_septo_pe_done")) {
    lines.push(septumSummaryLine(values));
    const chr = sidedFindingLine("하비갑개 비후(CHR)", "n_chr", values);
    if (chr) lines.push(chr);
  }

  if (bool(values, "n_ess_pe_done")) {
    // 화면의 ESS P/E 입력 순서(UP attach -> 이상 소견 6개 -> 비용종)와
    // 그대로 맞춘다.
    const uncinate = uncinateLine(values);
    if (uncinate) lines.push(uncinate);
    lines.push(
      bool(values, "n_cb_present")
        ? `Concha bullosa: ${str(values, "n_cb_side", "양측")}`
        : "Concha bullosa 없음",
    );
    const skullBase = presentSidedLine("Low skull base", "n_skull_base_risk_present", "n_skull_base_risk_side", values);
    if (skullBase) lines.push(skullBase);
    const onodi = presentSidedLine("Onodi's cell", "n_onodi_present", "n_onodi_side", values);
    if (onodi) lines.push(onodi);
    const haller = presentSidedLine("Haller's cell", "n_haller_present", "n_haller_side", values);
    if (haller) lines.push(haller);
    const lpDehiscence = presentSidedLine(
      "Lamina papyracea 결손",
      "n_lp_dehiscence_present",
      "n_lp_dehiscence_side",
      values,
    );
    if (lpDehiscence) lines.push(lpDehiscence);
    const dehiscence = presentSidedLine(
      "시신경/경동맥 골 결손",
      "n_dehiscence_present",
      "n_dehiscence_side",
      values,
    );
    if (dehiscence) lines.push(dehiscence);
    lines.push(polypFindingText(values));
  }

  return lines.join("\n");
}

// 예정 술식 표는 한눈에 보는 용도라 "없음/정상" 항목까지 다 나열하면 오히려
// 읽기 어려워진다. 실제로 임상적 의미가 있는(정상/기본값이 아닌) 소견만 짧게
// 추려서 보여준다 — 전체 서술문(nasalFindingsText)과는 별도로 둔다.
export function nasalFindingsSummary(values: FieldValues): string {
  if (!bool(values, "n_septo_pe_done") && !bool(values, "n_ess_pe_done")) return "";

  const items: string[] = [];

  if (bool(values, "n_septo_pe_done")) {
    const devSide = str(values, "n_dev_side", "특이 만곡 없음");
    const devDegree = str(values, "n_deviation", "해당없음");
    if (devSide !== "특이 만곡 없음" && devDegree !== "해당없음") {
      items.push(`비중격 ${devSide} ${devDegree} 편위`);
    }

    if (str(values, "n_septal_perforation", "없음") === "있음") items.push("비중격 천공");
    const septumNote = str(values, "n_septum_note", "");
    if (septumNote) items.push(septumNote);

    const chr = str(values, "n_chr", "없음");
    if (chr !== "없음") items.push(`${chr} 하비갑개 비후(CHR)`);
  }

  if (!bool(values, "n_ess_pe_done")) {
    return items.length > 0 ? items.join(", ") + "." : "특이 소견 없음";
  }

  // 화면의 ESS P/E 입력 순서(UP attach -> 이상 소견 6개 -> 비용종)와 그대로 맞춘다.
  // UP attach는 어떤 값이든 frontal sinusotomy 접근 계획에 항상 참고되는
  // 정보라, 다른 항목과 달리 "흔한 값(LP)"이어도 요약에서 빼지 않고 항상 넣는다.
  const uncLeft = str(values, "n_uncinate_left", "");
  const uncRight = str(values, "n_uncinate_right", "");
  if (uncLeft || uncRight) {
    const parts: string[] = [];
    if (uncRight) parts.push(`우측 ${uncRight}`);
    if (uncLeft) parts.push(`좌측 ${uncLeft}`);
    items.push(`UP attach ${parts.join(", ")}`);
  }

  if (bool(values, "n_cb_present")) {
    items.push(`${str(values, "n_cb_side", "양측")} concha bullosa`);
  }

  if (bool(values, "n_skull_base_risk_present")) {
    items.push(`${str(values, "n_skull_base_risk_side", "양측")} Low skull base`);
  }

  if (bool(values, "n_onodi_present")) {
    items.push(`${str(values, "n_onodi_side", "양측")} Onodi's cell`);
  }

  if (bool(values, "n_haller_present")) {
    items.push(`${str(values, "n_haller_side", "양측")} Haller's cell`);
  }

  if (bool(values, "n_lp_dehiscence_present")) {
    items.push(`${str(values, "n_lp_dehiscence_side", "양측")} Lamina papyracea 결손`);
  }

  if (bool(values, "n_dehiscence_present")) {
    items.push(`${str(values, "n_dehiscence_side", "양측")} 시신경/경동맥 골 결손`);
  }

  if (hasPolyp(values)) {
    items.push(polypFindingText(values));
  }

  // 요약도 항목을 쉼표로 이어붙인 한 줄짜리 문단이면 읽기 어려워서, 소견
  // 하나당 한 줄씩 나눠 보여준다(위 whitespace-pre-wrap 표시 영역과 짝).
  return items.length > 0 ? items.join("\n") : "특이 소견 없음";
}

// ---------- Turbinoplasty (비중격교정술/FESS 공통) ----------

const turbinateFields: { key: string; side: "좌측" | "우측"; label: string }[] = [
  { key: "turb_middle_right", side: "우측", label: "Middle turbinoplasty" },
  { key: "turb_inferior_right", side: "우측", label: "Inferior turbinoplasty" },
  { key: "turb_middle_left", side: "좌측", label: "Middle turbinoplasty" },
  { key: "turb_inferior_left", side: "좌측", label: "Inferior turbinoplasty" },
];

function turbinateLabelsForSide(side: "좌측" | "우측", values: FieldValues): string[] {
  return turbinateFields.filter((f) => f.side === side && bool(values, f.key)).map((f) => f.label);
}

function allTurbinateItems(values: FieldValues): string[] {
  return turbinateFields.filter((f) => bool(values, f.key)).map((f) => `${f.side} ${f.label}`);
}

// 중비갑개 축소술은 하비갑개 축소술과 임상적 의미가 달라 수술명에도 별개로
// 표기한다 (Turbinoplasty = 하비갑개, Mturbinoplasty = 중비갑개). 양쪽 다
// 같은 turbinoplasty를 했으면 수술명 맨 뒤에 "Both Turbinoplasty"처럼 따로
// 빼서 붙이고, 한쪽만 했으면 그 side의 ESS 표기 바로 뒤에 붙인다(그래서
// ESS가 대칭이라 "Both ESS(...)"로 합쳐지는 경우에도 turbinoplasty가
// 비대칭이면 그 병합을 깨고 side별로 다시 나눠 보여준다).
type TurbType = "inferior" | "middle";
const turbTypeWord: Record<TurbType, string> = { inferior: "Turbinoplasty", middle: "Mturbinoplasty" };
const turbTypes: TurbType[] = ["inferior", "middle"];

function turbSideFlags(type: TurbType, values: FieldValues): { right: boolean; left: boolean } {
  return { right: bool(values, `turb_${type}_right`), left: bool(values, `turb_${type}_left`) };
}

// ESS 부위 표기 옆에 붙일, 그 side에서만 시행한(비대칭인) turbinoplasty 단어들
function turbinoplastyWordsForSide(side: "right" | "left", values: FieldValues): string[] {
  return turbTypes
    .filter((type) => {
      const flags = turbSideFlags(type, values);
      return flags.right !== flags.left && flags[side];
    })
    .map((type) => turbTypeWord[type]);
}

// 축소술 기본 술기 — 중비갑개는 MES 절개 후 cutting forceps로 lateral side를
// 제거하는 방식, 하비갑개는 coblator를 이용하는 것을 기본값으로 서술한다.
function turbinoplastyTechniqueSentence(type: TurbType): string {
  if (type === "middle") {
    return "중비갑개에 대해 MES 절개 후 cutting forceps로 lateral side를 제거하는 방식으로 축소술(Mturbinoplasty)을 시행함";
  }
  return "하비갑개에 대해 coblator를 이용하여 축소술(Turbinoplasty)을 시행함";
}

function turbTypeSideLabel(type: TurbType, values: FieldValues): string {
  const flags = turbSideFlags(type, values);
  if (flags.right && flags.left) return "양측";
  if (flags.right) return "우측";
  if (flags.left) return "좌측";
  return "";
}

// 양쪽 다 같은 turbinoplasty를 했으면 여기서 전역 접미사로 처리하고,
// ESS 쪽에 붙일 side segment가 아예 없는 경우(비중격교정술 단독 등)는
// 한쪽만 했더라도 여기서 방향 표기와 함께 접미사로 처리한다.
function turbinoplastyGlobalSuffix(values: FieldValues, style: NameStyle, hasSideSegments: boolean): string {
  const parts: string[] = [];
  for (const type of turbTypes) {
    const flags = turbSideFlags(type, values);
    if (!flags.right && !flags.left) continue;
    if (flags.right && flags.left) {
      parts.push(`${formatSideLabel("B", style)} ${turbTypeWord[type]}`);
    } else if (!hasSideSegments) {
      parts.push(`${formatSideLabel(flags.right ? "R" : "L", style)} ${turbTypeWord[type]}`);
    }
  }
  return parts.length > 0 ? ` + ${parts.join(" + ")}` : "";
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
  const turbMiddleSide = turbTypeSideLabel("middle", values);
  const turbInferiorSide = turbTypeSideLabel("inferior", values);
  const splint = bool(values, "s_splint");
  const quiltingSuture = str(values, "s_quilting_suture", "4-0 chromic catgut");
  const splintSuture = str(values, "s_splint_suture", "4-0 nylon");

  const steps: (string | false)[] = [
    incisionSentence(values),
    caudal && "Caudal septum의 편위 부위에 대해 함께 교정을 시행함",
    spur && "골성 비중격(perpendicular plate of ethmoid, vomer)에서 bony spur를 확인하고 제거함",
    "확인된 편위 부위의 변형된 septal cartilage 및 골성 비중격 일부를 절제 및 교정하여 straightening 후 정중앙에 위치시킴",
    "Microdebrider를 이용하여 골성 및 연골성 비중격 조작을 보조적으로 시행함",
    turbMiddleSide && `${turbMiddleSide} ${turbinoplastyTechniqueSentence("middle")}`,
    turbInferiorSide && `${turbInferiorSide} ${turbinoplastyTechniqueSentence("inferior")}`,
    `Flap을 원위치로 정복한 후 ${quiltingSuture}를 사용하여 quilting suture 시행`,
    splint && `양측 비강에 silastic splint를 삽입하고 ${splintSuture}로 관통 봉합하여 고정함`,
  ];
  return steps.filter((s): s is string => Boolean(s));
}

function genSeptoplasty(values: FieldValues, mode: OpNoteMode, anesLabel: string): OpNoteResult {
  const localAnesthetic = str(values, "s_local_anesthetic", "1% lidocaine with epinephrine, 총 5cc");

  const steps: (string | false)[] = [];
  if (mode === "record") {
    steps.push(`환자를 앙와위로 눕히고 ${anesLabel} 하에 수술을 시작함`);
    steps.push(sphenopalatineBlockSentence("양측"));
    steps.push(`${localAnesthetic}를 비중격 점막에 국소 침윤 마취함`);
  }
  steps.push(...septoCore(values));
  steps.push("양측 비강에 Nasocel로 1차 packing을 시행함");
  steps.push(dermacolSentence(values) || false);
  steps.push("이어서 Rhinocel로 마무리 packing을 시행하고 출혈 소견 없음을 확인한 후 수술을 종료함");

  return { findings: nasalFindingsText(values), procedureDetail: numberSteps(steps) };
}

// ---------- FESS ----------

const fessStepSentences: Record<(typeof fessStepFieldKeys)[number], string> = {
  mma: "Middle meatal antrostomy를 통해 상악동 자연공 확장",
  ant_eth: "Anterior ethmoidectomy 시행",
  post_eth: "Posterior ethmoidectomy 시행",
  sphenoid: "Sphenoidotomy 시행",
  frontal: "Frontal sinusotomy 시행함",
};

function fessSideBlock(sideName: "좌측" | "우측", prefix: "f_left_" | "f_right_", values: FieldValues): string[] {
  const selectedSteps = fessStepFieldKeys.filter((key) => bool(values, `${prefix}${key}`));
  const turbLabels = turbinateLabelsForSide(sideName, values);
  // 해당 측에 실제로 시행한 것이 하나도 없으면(반대측만 시행한 편측 FESS 등)
  // "수술을 진행함"이나 "비용종 제거함" 같은 문장이 생기지 않도록 블록 자체를 건너뜀
  if (selectedSteps.length === 0 && turbLabels.length === 0) {
    return [];
  }

  const block: string[] = [`[${sideName}] 내시경(0°/30°)을 이용하여 수술을 진행함`];

  if (selectedSteps.length > 0) {
    // Microdebrider는 비용종이 있을 때만 쓰는 게 아니라 ESS 전반의 점막/조직
    // 정리에 기본적으로 쓰이므로, 비용종 유무와 무관하게 기본 문구로 넣는다.
    block.push(`[${sideName}] Microdebrider를 이용하여 점막 및 병변 조직을 정리하며 수술을 진행함`);
    // Uncinectomy는 MMA/Ant.&Post. ethmoidectomy/Frontal sinusotomy를 할 때는
    // 선행되는 조작이라 자동으로 포함시키지만, Sphenoidotomy만 단독으로 할
    // 때는 uncinectomy 없이도 접근 가능해서 자동으로 넣지 않는다. Revision
    // case(재수술)에서는 이전 수술에서 이미 uncinectomy가 되어 있을 수 있어
    // 자동 판단 대신 직접 체크한 값을 그대로 따른다.
    const isRevision = bool(values, "f_revision");
    const needsUncinectomy = isRevision
      ? bool(values, `${prefix}uncinectomy`)
      : selectedSteps.some((key) => key !== "sphenoid");
    if (needsUncinectomy) {
      block.push(`[${sideName}] Uncinectomy 시행`);
    }
    for (const key of selectedSteps) {
      block.push(`[${sideName}] ${fessStepSentences[key]}`);
    }
  }

  const turbSuffix = prefix === "f_left_" ? "left" : "right";
  if (bool(values, `turb_middle_${turbSuffix}`)) {
    block.push(`[${sideName}] ${turbinoplastyTechniqueSentence("middle")}`);
  }
  if (bool(values, `turb_inferior_${turbSuffix}`)) {
    block.push(`[${sideName}] ${turbinoplastyTechniqueSentence("inferior")}`);
  }

  return block;
}

// Silastic sheet 삽입 — 좌/우 각 블록 안에서 언급하지 않고, packing 직전에
// 한 문장으로 모아서 서술한다. 좌우 구분 없이 하나의 체크박스로만 관리한다.
function silasticSheetSentence(values: FieldValues): string {
  if (!bool(values, "f_silastic_sheet")) return "";
  return "유착 방지를 위해 양측 middle meatus에 silastic sheet를 삽입함";
}

function fessCore(values: FieldValues): string[] {
  const order = str(values, "f_side_order", "우측 먼저 → 좌측");
  const nav = bool(values, "f_nav");

  const steps: string[] = [];
  if (nav) steps.push("Image-guided navigation system을 병용하여 해부학적 구조물을 확인함");

  const leftBlock = fessSideBlock("좌측", "f_left_", values);
  const rightBlock = fessSideBlock("우측", "f_right_", values);

  if (order === "좌측 먼저 → 우측") steps.push(...leftBlock, ...rightBlock);
  else steps.push(...rightBlock, ...leftBlock);

  return steps;
}

// 국소마취(sphenopalatine block) 주입 방향은 실제 수술 범위에 맞춰
// 편측/양측을 판단한다 — turbinoplasty만 시행한 side도 수술 범위에 포함시킨다.
function fessOperativeSideLabel(values: FieldValues): string {
  const rightActive =
    fessRegionsForSide("f_right_", values).length > 0 || turbinateLabelsForSide("우측", values).length > 0;
  const leftActive =
    fessRegionsForSide("f_left_", values).length > 0 || turbinateLabelsForSide("좌측", values).length > 0;
  if (rightActive && leftActive) return "양측";
  if (rightActive) return "우측";
  if (leftActive) return "좌측";
  return "양측";
}

function genFess(values: FieldValues, mode: OpNoteMode, anesLabel: string): OpNoteResult {
  const steps: (string | false)[] = [];
  if (mode === "record") {
    steps.push(`환자를 앙와위로 눕히고 ${anesLabel} 하에 수술을 시작함`);
    steps.push(revisionSentence(values) || false);
    steps.push("Epinephrine을 적신 patty로 양측 비강 점막을 수축시킴");
    steps.push(sphenopalatineBlockSentence(fessOperativeSideLabel(values)));
  }
  steps.push(...fessCore(values));
  steps.push(silasticSheetSentence(values) || false);
  steps.push("양측 수술 부위 지혈 상태를 확인한 후 Nasocel로 1차 packing을 시행함");
  steps.push(dermacolSentence(values) || false);
  steps.push("이어서 Rhinocel로 마무리 packing을 시행하고 수술을 종료함");

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
  const nav = bool(values, "f_nav");
  const order = str(values, "c_order", "비중격 → 우 FESS → 좌 FESS");

  const opening: string[] = [];
  if (mode === "record") {
    opening.push(`환자를 앙와위로 눕히고 ${anesLabel} 하에 수술을 시작함`);
    const revision = revisionSentence(values);
    if (revision) opening.push(revision);
    opening.push("Epinephrine을 적신 patty로 비중격 및 비강 점막을 수축시킴");
    opening.push(sphenopalatineBlockSentence("양측"));
  }
  if (nav) opening.push("Image-guided navigation system을 병용하여 해부학적 구조물을 확인함");

  const blocks: Record<"septo" | "left" | "right", string[]> = {
    septo: septoCore(values),
    left: fessSideBlock("좌측", "f_left_", values),
    right: fessSideBlock("우측", "f_right_", values),
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
  const closingSteps: (string | false)[] = [
    silasticSheetSentence(values) || false,
    "양측 비강에 Nasocel로 1차 packing을 시행함",
    dermacolSentence(values) || false,
    "이어서 Rhinocel로 마무리 packing을 시행하고 출혈 소견 없음을 확인한 후 수술을 종료함",
  ];
  parts.push(numberSteps(closingSteps, n));

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
    bool(values, "s_splint") && "Silastic splint 삽입",
  ];
  if (includePacking) items.push("Nasocel + Rhinocel packing 예정");
  return items.filter((s): s is string => Boolean(s));
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

// Frontal/Sphenoid/Maxillary는 그 자체로 하나의 독립된 수술 술식이라,
// 그 부위 딱 하나만 시행했을 때는 "ESS(Frontal)"처럼 뭉뚱그리지 않고
// 실제 술식명을 그대로 쓴다. Ethmoid는 전/후방을 나눠 시행할 수 있어
// 하나의 고정된 술식명으로 보기 어려워서 여기서는 제외한다.
const SINGLE_REGION_PROCEDURE_NAMES: Partial<Record<(typeof fessRegionOrder)[number], string>> = {
  Frontal: "Frontal sinusotomy",
  Sphenoid: "Sphenoidotomy",
  Maxillary: "MMA",
};

function regionSegment(label: string, regions: string[], style: NameStyle): string {
  if (regions.length === 1) {
    const single = SINGLE_REGION_PROCEDURE_NAMES[regions[0] as (typeof fessRegionOrder)[number]];
    if (single) return single;
  }
  return `${label}(${formatRegionList(regions, style)})`;
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
  const leftTurb = turbinoplastyWordsForSide("left", values);
  const rightTurb = turbinoplastyWordsForSide("right", values);

  if (left.length === 0 && right.length === 0) return label;

  const sameSet = left.length === right.length && left.every((r, i) => r === right[i]);
  if (left.length > 0 && right.length > 0 && sameSet && leftTurb.length === 0 && rightTurb.length === 0) {
    return `${formatSideLabel("B", style)} ${regionSegment(label, left, style)}`;
  }

  const parts: string[] = [];
  if (right.length > 0) {
    const turbText = rightTurb.length > 0 ? ` ${rightTurb.join(" ")}` : "";
    parts.push(`${formatSideLabel("R", style)} ${regionSegment(label, right, style)}${turbText}`);
  } else if (rightTurb.length > 0) {
    parts.push(`${formatSideLabel("R", style)} ${rightTurb.join(" ")}`);
  }
  if (left.length > 0) {
    const turbText = leftTurb.length > 0 ? ` ${leftTurb.join(" ")}` : "";
    parts.push(`${formatSideLabel("L", style)} ${regionSegment(label, left, style)}${turbText}`);
  } else if (leftTurb.length > 0) {
    parts.push(`${formatSideLabel("L", style)} ${leftTurb.join(" ")}`);
  }
  return parts.join(", ");
}

export function buildProcedureName(
  surgeryCode: BuiltInSurgeryCode,
  values: FieldValues,
  style: NameStyle = DEFAULT_NAME_STYLE,
): string {
  const hasFessRegions =
    surgeryCode !== "SEPTOPLASTY" &&
    (fessRegionsForSide("f_left_", values).length > 0 || fessRegionsForSide("f_right_", values).length > 0);
  const turbSuffix = turbinoplastyGlobalSuffix(values, style, hasFessRegions);
  // Revision case(재수술)는 수술명 맨 앞에 표기한다 (FESS가 포함된 경우만
  // 해당 — f_revision은 fessFields에만 있는 필드).
  const revisionPrefix = surgeryCode !== "SEPTOPLASTY" && bool(values, "f_revision") ? "Revision " : "";

  if (surgeryCode === "SEPTOPLASTY") return `Septoplasty${turbSuffix}`;
  if (surgeryCode === "ESS") return `${revisionPrefix}${buildFessProcedureName(values, "ESS", style)}${turbSuffix}`;
  return `${revisionPrefix}Septoplasty + ${buildFessProcedureName(values, "ESS", style)}${turbSuffix}`;
}

// ---------- Op Plan 표 형식 (인쇄용 — 내시경 앞에 붙여두고 한눈에 보는 용도) ----------

export interface PlanKeyValueRow {
  label: string;
  value: string;
}

export interface PlanSideMatrixRow {
  key: string;
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
  const rows: PlanSideMatrixRow[] = [];
  // Revision case(재수술)에서는 uncinectomy가 이전 수술에서 이미 됐을 수
  // 있어 자동 판단 대신 직접 체크하게 하므로, 표에서도 맨 위에 보여준다.
  if (bool(values, "f_revision")) {
    rows.push({
      key: "uncinectomy",
      label: "Uncinectomy",
      left: bool(values, "f_left_uncinectomy"),
      right: bool(values, "f_right_uncinectomy"),
    });
  }
  rows.push(
    ...fessStepFieldKeys.map((k) => ({
      key: k,
      label: fessStepLabels[k],
      left: bool(values, `f_left_${k}`),
      right: bool(values, `f_right_${k}`),
    })),
  );
  return { title: "FESS 시행 부위", rows };
}

// 패킹 재료는 항상 Nasocel + Rhinocel 병용이 기본이고, Dermacol은 packing
// 재료는 아니지만 같이 도포하는 경우가 많아 표에서는 한 칸에 묶어 보여준다.
function packingCellValue(values: FieldValues): string {
  return bool(values, "dermacol") ? "Nasocel + Rhinocel + Dermacol" : "Nasocel + Rhinocel";
}

export function buildPlanTable(
  surgeryCode: BuiltInSurgeryCode,
  values: FieldValues,
  style: NameStyle = DEFAULT_NAME_STYLE,
): PlanTable {
  const procedureName = buildProcedureName(surgeryCode, values, style);
  const findings = nasalFindingsSummary(values);
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
        { label: "Packing / Material", value: packingCellValue(values) },
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
        { label: "Packing / Material", value: packingCellValue(values) },
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
      { label: "Packing / Material(공통)", value: packingCellValue(values) },
    ],
    sideMatrix: fessSideMatrix(values),
  };
}

// 복사(클립보드)용 — 표를 일반 텍스트로 풀어서 준다
export function planTableToText(table: PlanTable): string {
  const lines: string[] = [`수술명: ${table.procedureName}`, "", `[비강 소견] ${table.findings}`, ""];
  for (const row of table.keyValueRows) lines.push(`${row.label}: ${row.value}`);
  if (table.sideMatrix) {
    lines.push("", table.sideMatrix.title);
    for (const row of table.sideMatrix.rows) {
      lines.push(`  ${row.label} - 우측: ${row.right ? "O" : "-"} / 좌측: ${row.left ? "O" : "-"}`);
    }
  }
  return lines.join("\n");
}
