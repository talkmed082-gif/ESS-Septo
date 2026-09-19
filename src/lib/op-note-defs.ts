import type { SurgeryFieldDef } from "./field-types";

// 두 비강 소견 그룹(Septoturbinoplasty용/ESS용)을 각각 접어두고, 실제로
// 그 진찰을 기록할 때만 체크해서 펼치는 스위치. 이 체크 여부가 기록지
// 자동 생성 시 해당 그룹 내용을 포함할지 그대로 결정한다.
export const SEPTO_PE_DONE_KEY = "n_septo_pe_done";
export const ESS_PE_DONE_KEY = "n_ess_pe_done";

// 비강 소견 - 비중격/하비갑개 그룹 (Septoturbinoplasty용) — 비중격교정술
// 단독 시행 시에는 이 그룹만 있으면 충분하고, ESS/FESS 관련 CT 소견은
// 필요 없어서 별도 그룹으로 분리한다.
export const septumTurbinateFindingFields: SurgeryFieldDef[] = [
  { key: SEPTO_PE_DONE_KEY, label: "Septoturbinoplasty P/E 시행", type: "checkbox" },
  {
    key: "n_dev_side",
    label: "비중격 편위 방향",
    type: "select",
    options: ["특이 만곡 없음", "우측", "좌측", "양측(C자형)"],
    default: "특이 만곡 없음",
  },
  {
    key: "n_deviation",
    label: "비중격 만곡 정도",
    type: "select",
    options: ["해당없음", "경도", "중등도", "고도"],
    default: "해당없음",
  },
  // 비중격 특이사항 — 편위/만곡 정도와는 별개로 있는지 없는지가 중요한 소견
  // (천공 등). 위 두 항목 바로 옆에 둬서 비중격 관련 소견끼리 모아둔다.
  {
    key: "n_septal_perforation",
    label: "비중격 천공 (Septal perforation)",
    type: "select",
    options: ["없음", "있음"],
    default: "없음",
  },
  {
    key: "n_septum_note",
    label: "비중격 기타 특이사항 (예: 천공 크기/위치, 연골괴사 등)",
    type: "text",
  },
  // 하비갑개 비후 — 비중격교정술과 흔히 같이 시행되는 turbinoplasty의
  // 적응증이라 비중격 소견과 한 그룹으로 묶는다.
  {
    key: "n_chr",
    label: "하비갑개 비후 (CHR, Chronic Hypertrophic Rhinitis)",
    type: "select",
    options: ["없음", "우측", "좌측", "양측"],
    default: "없음",
  },
];

// SeptumDiagram과 한 화면에 묶어서 보여줄 비중격 상세 필드 — 방향(n_dev_side)은
// 모식도가 담당하고, 나머지는 모식도 바로 아래 이어서 보여준다.
export const SEPTUM_DETAIL_FIELD_KEYS = ["n_deviation", "n_septal_perforation", "n_septum_note", "n_chr"];

// Uncinate process attachment는 "이상 소견"이 아니라 frontal sinusotomy 접근
// 계획에 항상 참고하는 해부학적 변이라, ESS 이상소견(EssFindingsPicker) 위에
// 먼저 보여준다.
export const UNCINATE_FIELD_KEYS = ["n_uncinate_right", "n_uncinate_left"];

// 비강 소견 - ESS(FESS)용 그룹 — 부비동 내시경수술 접근/안전 계획에 필요한
// 내시경·CT 소견. 비중격교정술 단독 시행 시에는 필요 없다.
export const essFindingFields: SurgeryFieldDef[] = [
  { key: ESS_PE_DONE_KEY, label: "ESS P/E 시행", type: "checkbox" },
  // Uncinate process attachment — frontal recess 배출 경로를 결정하는 해부학적
  // 변이로, FESS 시 frontal sinusotomy 접근 방향 계획에 항상 참고되는 값이라
  // 기록지 요약에서도 값과 무관하게 항상 표시한다. 기본값은 가장 흔한 부착 부위인
  // Lamina papyracea.
  {
    key: "n_uncinate_right",
    label: "Uncinate process attachment - 우측",
    type: "select",
    options: ["Lamina papyracea", "Skull base", "중비갑개 (Middle turbinate)", "불명확/혼합"],
    default: "Lamina papyracea",
  },
  {
    key: "n_uncinate_left",
    label: "Uncinate process attachment - 좌측",
    type: "select",
    options: ["Lamina papyracea", "Skull base", "중비갑개 (Middle turbinate)", "불명확/혼합"],
    default: "Lamina papyracea",
  },
  // 문제(이상 소견)가 있는지부터 체크하고, 있을 때만 좌/우/양측을 고르는
  // 2단계 구조 — 기본이 "정상/없음"인 항목을 매번 드롭다운에서 고르게
  // 하지 않고 체크 안 하면 그대로 넘어가게 해서 입력을 줄인다. Keros
  // Type을 좌우 각각 재는 대신 "Low skull base 있는지"만 체크한다.
  { key: "n_cb_present", label: "Concha bullosa 있음", type: "checkbox" },
  { key: "n_cb_side", label: "Concha bullosa - 방향", type: "select", options: ["좌측", "우측", "양측"] },
  {
    key: "n_skull_base_risk_present",
    label: "Low skull base 있음 (Keros II/III 의심)",
    type: "checkbox",
  },
  {
    key: "n_skull_base_risk_side",
    label: "Low skull base - 방향",
    type: "select",
    options: ["좌측", "우측", "양측"],
  },
  { key: "n_onodi_present", label: "Onodi's cell 있음 (접형사골동)", type: "checkbox" },
  { key: "n_onodi_side", label: "Onodi's cell - 방향", type: "select", options: ["좌측", "우측", "양측"] },
  { key: "n_haller_present", label: "Haller's cell 있음 (안하사골봉소)", type: "checkbox" },
  { key: "n_haller_side", label: "Haller's cell - 방향", type: "select", options: ["좌측", "우측", "양측"] },
  {
    key: "n_lp_dehiscence_present",
    label: "Lamina papyracea 결손 있음",
    type: "checkbox",
  },
  {
    key: "n_lp_dehiscence_side",
    label: "Lamina papyracea 결손 - 방향",
    type: "select",
    options: ["좌측", "우측", "양측"],
  },
  {
    key: "n_dehiscence_present",
    label: "시신경/경동맥 골 결손 있음 (Optic nerve/ICA dehiscence)",
    type: "checkbox",
  },
  {
    key: "n_dehiscence_side",
    label: "시신경/경동맥 골 결손 - 방향",
    type: "select",
    options: ["좌측", "우측", "양측"],
  },
  // 비용종 — 좌/우 정도(위치)가 다른 경우가 많아, 공통 "방향" 선택 없이
  // 측별로 위치 체크박스를 따로 둔다 (PolypPicker 컴포넌트가 우/좌 두 컬럼으로
  // 노출 — 한쪽이라도 위치가 체크되어 있으면 그 측에 비용종이 있는 것으로 본다).
  { key: "n_polyp_right_site_mm", label: "비용종 위치(우측) - 중비도", type: "checkbox" },
  { key: "n_polyp_right_site_ethmoid", label: "비용종 위치(우측) - 사골동", type: "checkbox" },
  { key: "n_polyp_right_site_maxillary", label: "비용종 위치(우측) - 상악동 자연공", type: "checkbox" },
  { key: "n_polyp_right_site_sphenoid", label: "비용종 위치(우측) - 접형동", type: "checkbox" },
  { key: "n_polyp_right_site_choana", label: "비용종 위치(우측) - 후비공까지 연장", type: "checkbox" },
  { key: "n_polyp_left_site_mm", label: "비용종 위치(좌측) - 중비도", type: "checkbox" },
  { key: "n_polyp_left_site_ethmoid", label: "비용종 위치(좌측) - 사골동", type: "checkbox" },
  { key: "n_polyp_left_site_maxillary", label: "비용종 위치(좌측) - 상악동 자연공", type: "checkbox" },
  { key: "n_polyp_left_site_sphenoid", label: "비용종 위치(좌측) - 접형동", type: "checkbox" },
  { key: "n_polyp_left_site_choana", label: "비용종 위치(좌측) - 후비공까지 연장", type: "checkbox" },
];

// 비강 소견(공통, ESS/병행용) — 비중격/하비갑개 그룹 + ESS 그룹을 모두 포함
export const nasalFindingFields: SurgeryFieldDef[] = [
  ...septumTurbinateFindingFields,
  ...essFindingFields,
];

// Turbinoplasty(실제 시행 여부) — 소견이 아니라 술식이라 "수술 방법" 페이지로 감.
// 비중격교정술/FESS 어느 쪽에도 단독 또는 동반될 수 있어 공통 항목으로 둠
export const turbinoplastyFields: SurgeryFieldDef[] = [
  { key: "turb_middle_right", label: "중비갑개 축소술 - 우측", type: "checkbox" },
  { key: "turb_middle_left", label: "중비갑개 축소술 - 좌측", type: "checkbox" },
  { key: "turb_inferior_right", label: "하비갑개 축소술 - 우측", type: "checkbox" },
  { key: "turb_inferior_left", label: "하비갑개 축소술 - 좌측", type: "checkbox" },
];

// 비중격교정술 전용 항목
export const septoFields: SurgeryFieldDef[] = [
  {
    key: "s_incision",
    label: "절개(Incision) 방법",
    type: "select",
    options: [
      "Hemitransfixion incision",
      "Killian incision",
      "Full transfixion incision",
      "Cottle incision (maxilla-premaxillary)",
    ],
    default: "Hemitransfixion incision",
  },
  {
    key: "s_incision_side",
    label: "절개 방향 (시작 측)",
    type: "select",
    options: ["우측", "좌측"],
  },
  { key: "s_caudal", label: "Caudal septum 편위 동반 교정", type: "checkbox" },
  { key: "s_spur", label: "Bony spur 제거", type: "checkbox" },
  { key: "s_splint", label: "Silastic splint 삽입", type: "checkbox" },
  { key: "dermacol", label: "Dermacol 도포", type: "checkbox" },
  {
    key: "s_local_anesthetic",
    label: "비중격 국소마취제 (종류/용량)",
    type: "text",
    default: "1% lidocaine with epinephrine, 총 5cc",
  },
  {
    key: "s_quilting_suture",
    label: "Quilting suture 봉합사",
    type: "text",
    default: "4-0 chromic catgut",
  },
  {
    key: "s_splint_suture",
    label: "Splint 고정 봉합사",
    type: "text",
    default: "4-0 nylon",
  },
];

// FESS 좌/우 각각 시행 술식 — Uncinectomy는 FESS 시행 시 당연히 포함되는 기본
// 조작이라 선택 항목에서는 빼고, 기록지 서술문 생성 시 자동으로 포함시킨다.
export const fessStepFieldKeys = ["mma", "ant_eth", "post_eth", "sphenoid", "frontal"] as const;

export const fessStepLabels: Record<(typeof fessStepFieldKeys)[number], string> = {
  mma: "MMA (Middle meatal antrostomy)",
  ant_eth: "Ant. ethmoidectomy",
  post_eth: "Post. ethmoidectomy",
  sphenoid: "Sphenoidotomy",
  frontal: "Frontal sinusotomy",
};

// FESS 전용 항목
export const fessFields: SurgeryFieldDef[] = [
  {
    key: "f_side_order",
    label: "시행 순서",
    type: "select",
    options: ["우측 먼저 → 좌측", "좌측 먼저 → 우측"],
  },
  ...fessStepFieldKeys.map((k) => ({
    key: `f_right_${k}`,
    label: `우측 - ${fessStepLabels[k]}`,
    type: "checkbox" as const,
  })),
  ...fessStepFieldKeys.map((k) => ({
    key: `f_left_${k}`,
    label: `좌측 - ${fessStepLabels[k]}`,
    type: "checkbox" as const,
  })),
  { key: "f_silastic_sheet", label: "Silastic sheet 삽입 (유착 방지)", type: "checkbox" },
  { key: "f_nav", label: "Navigation 병용", type: "checkbox" },
  { key: "dermacol", label: "Dermacol 도포", type: "checkbox" },
];

// 병행(비중격교정술 + FESS) 전용 항목 — 순서 및 최종 packing만 별도로 결정
export const comboOnlyFields: SurgeryFieldDef[] = [
  {
    key: "c_order",
    label: "시행 순서 (비중격 / 좌측 FESS / 우측 FESS)",
    type: "select",
    options: [
      "비중격 → 우 FESS → 좌 FESS",
      "비중격 → 좌 FESS → 우 FESS",
      "우 FESS → 비중격 → 좌 FESS",
      "좌 FESS → 비중격 → 우 FESS",
      "우 FESS → 좌 FESS → 비중격",
      "좌 FESS → 우 FESS → 비중격",
    ],
  },
];

// dermacol은 septoFieldsForCombo 쪽에 이미 포함되어 있으므로 중복 방지를 위해 fessFieldsForCombo에서는 뺀다.
const septoFieldsForCombo = septoFields;
const fessFieldsForCombo = fessFields.filter((f) => f.key !== "dermacol");

// ESS/병행은 비강소견 두 그룹(비중격/하비갑개 + ESS)을 모두 보여주고,
// 비중격교정술 단독은 비중격/하비갑개 그룹만 보여준다(ESS 전용 CT 소견 불필요).
export const essFullFields: SurgeryFieldDef[] = [
  ...nasalFindingFields,
  ...turbinoplastyFields,
  ...fessFields,
];
export const septoplastyFullFields: SurgeryFieldDef[] = [
  ...septumTurbinateFindingFields,
  ...turbinoplastyFields,
  ...septoFields,
];
export const comboFullFields: SurgeryFieldDef[] = [
  ...nasalFindingFields,
  ...turbinoplastyFields,
  ...septoFieldsForCombo,
  ...fessFieldsForCombo,
  ...comboOnlyFields,
];

export const BUILT_IN_SURGERY_CODES = ["ESS", "SEPTOPLASTY", "COMBO"] as const;
export type BuiltInSurgeryCode = (typeof BUILT_IN_SURGERY_CODES)[number];

export function isBuiltInSurgeryCode(code: string): code is BuiltInSurgeryCode {
  return (BUILT_IN_SURGERY_CODES as readonly string[]).includes(code);
}

// 기록지/계획 화면을 "비강/영상 소견"과 "수술 방법" 두 페이지로 나눌 때 쓰는
// 분류 기준. 비강 소견(n_*)과 술전 CT 소견(skull_base_*)만 소견 페이지로 가고,
// turbinoplasty 시행 여부(turb_*)는 실제 시행한 술식이라 방법 페이지로 간다.
const NASAL_FINDING_KEY_PREFIXES = ["n_", "skull_base_"];

export function isNasalFindingKey(key: string): boolean {
  return NASAL_FINDING_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}
