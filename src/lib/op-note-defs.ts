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
    options: ["특이 만곡 없음", "우측", "양측(C자형)", "좌측"],
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
    label: "비중격 기타 특이사항",
    type: "multiselect",
    options: [
      "High deviation",
      "Caudal deviation",
      "Internal nasal valve narrowing",
      "External nasal valve narrowing",
      "Septal tubercle",
    ],
  },
  // 하비갑개 비후 — 비중격교정술과 흔히 같이 시행되는 turbinoplasty의
  // 적응증이라 비중격 소견과 한 그룹으로 묶는다.
  {
    key: "n_chr",
    label: "하비갑개 비후 (CHR, Chronic Hypertrophic Rhinitis)",
    type: "select",
    options: ["없음", "우측", "양측", "좌측"],
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
  // Uncinate process(UP) attachment — frontal recess 배출 경로를 결정하는
  // 해부학적 변이로, FESS 시 frontal sinusotomy 접근 방향 계획에 항상 참고되는
  // 값이라 기록지 요약에서도 값과 무관하게 항상 표시한다. 기본값은 가장 흔한
  // 부착 부위인 LP(Lamina papyracea). 약어: LP=Lamina papyracea,
  // SB=Skull base, MT=Middle turbinate, Mixed=불명확/혼합.
  {
    key: "n_uncinate_right",
    label: "UP attach - 우측",
    type: "select",
    options: ["LP", "SB", "MT", "Mixed"],
    default: "LP",
  },
  {
    key: "n_uncinate_left",
    label: "UP attach - 좌측",
    type: "select",
    options: ["LP", "SB", "MT", "Mixed"],
    default: "LP",
  },
  // 문제(이상 소견)가 있는지부터 체크하고, 있을 때만 좌/우/양측을 고르는
  // 2단계 구조 — 기본이 "정상/없음"인 항목을 매번 드롭다운에서 고르게
  // 하지 않고 체크 안 하면 그대로 넘어가게 해서 입력을 줄인다. Keros
  // Type을 좌우 각각 재는 대신 "Low skull base 있는지"만 체크한다.
  { key: "n_cb_present", label: "Concha bullosa 있음", type: "checkbox" },
  {
    key: "n_cb_side",
    label: "Concha bullosa - 방향",
    type: "select",
    options: ["우측", "양측", "좌측"],
    default: "양측",
  },
  {
    key: "n_skull_base_risk_present",
    label: "Low skull base 있음 (Keros II/III 의심)",
    type: "checkbox",
  },
  {
    key: "n_skull_base_risk_side",
    label: "Low skull base - 방향",
    type: "select",
    options: ["우측", "양측", "좌측"],
    default: "양측",
  },
  { key: "n_onodi_present", label: "Onodi's cell 있음 (접형사골동)", type: "checkbox" },
  { key: "n_onodi_side", label: "Onodi's cell - 방향", type: "select", options: ["우측", "양측", "좌측"] },
  { key: "n_haller_present", label: "Haller's cell 있음 (안하사골봉소)", type: "checkbox" },
  { key: "n_haller_side", label: "Haller's cell - 방향", type: "select", options: ["우측", "양측", "좌측"] },
  {
    key: "n_lp_dehiscence_present",
    label: "Lamina papyracea 결손 있음",
    type: "checkbox",
  },
  {
    key: "n_lp_dehiscence_side",
    label: "Lamina papyracea 결손 - 방향",
    type: "select",
    options: ["우측", "양측", "좌측"],
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
    options: ["우측", "양측", "좌측"],
  },
  // 해부학적 이상 소견뿐 아니라 염증(부비동염) 소견도 남겨야 비강 소견이
  // 완결된다 — 계획 단계에서 염증이 보여도 그 부위를 이번에 꼭 수술하는
  // 것은 아니라서(수술 방법/Op Plan의 시행 부위와는 별개 값), 시행 부위와
  // 같은 4개 부비동 기준으로 문제 있는지만 우선 체크하는 2단계 구조를 쓴다.
  { key: "n_sinusitis_frontal_present", label: "Frontal sinusitis 있음", type: "checkbox" },
  {
    key: "n_sinusitis_frontal_side",
    label: "Frontal sinusitis - 방향",
    type: "select",
    options: ["우측", "양측", "좌측"],
  },
  { key: "n_sinusitis_ethmoid_present", label: "Ethmoid sinusitis 있음", type: "checkbox" },
  {
    key: "n_sinusitis_ethmoid_side",
    label: "Ethmoid sinusitis - 방향",
    type: "select",
    options: ["우측", "양측", "좌측"],
  },
  { key: "n_sinusitis_maxillary_present", label: "Maxillary sinusitis 있음", type: "checkbox" },
  {
    key: "n_sinusitis_maxillary_side",
    label: "Maxillary sinusitis - 방향",
    type: "select",
    options: ["우측", "양측", "좌측"],
  },
  { key: "n_sinusitis_sphenoid_present", label: "Sphenoid sinusitis 있음", type: "checkbox" },
  {
    key: "n_sinusitis_sphenoid_side",
    label: "Sphenoid sinusitis - 방향",
    type: "select",
    options: ["우측", "양측", "좌측"],
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
  { key: "turb_middle_right", label: "Middle turbinoplasty - 우측", type: "checkbox" },
  { key: "turb_middle_left", label: "Middle turbinoplasty - 좌측", type: "checkbox" },
  { key: "turb_inferior_right", label: "Inferior turbinoplasty - 우측", type: "checkbox" },
  { key: "turb_inferior_left", label: "Inferior turbinoplasty - 좌측", type: "checkbox" },
];

// 비중격교정술 전용 항목
export const septoFields: SurgeryFieldDef[] = [
  // 어느 부위의 재수술인지(Septoturbinoplasty/우측 ESS/좌측 ESS)를 각각
  // 구분해서 표시해야 해서, ESS 쪽 revision(f_revision_ess_right/left)과
  // 별개의 플래그로 둔다.
  { key: "f_revision_septo", label: "Septoturbinoplasty Revision case (재수술)", type: "checkbox" },
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
    default: "좌측",
  },
  { key: "s_caudal", label: "Caudal septum 편위 동반 교정", type: "checkbox" },
  // ANS(Anterior nasal spine) 부위 편위가 심한 경우 선택적으로 시행하는
  // 술식 — septum을 ANS에서 분리한 후 절제하고 PDS 5-0로 고정한다.
  { key: "s_ans_release", label: "ANS 부위 비중격 분리·절제 후 PDS 5-0 고정", type: "checkbox" },
  { key: "s_spur", label: "Bony spur 제거", type: "checkbox" },
  { key: "s_splint", label: "Silastic splint 삽입", type: "checkbox", default: "true" },
  { key: "dermacol", label: "Dermacol 도포", type: "checkbox", default: "true" },
  {
    key: "s_local_anesthetic",
    label: "비중격 국소마취제 (종류/용량)",
    type: "text",
    default: "1% lidocaine with epinephrine, 총 5cc",
  },
  // 기본으로 하는 과정이 아니라 가끔만 추가로 시행하는 것이라 체크박스로
  // 켤 때만 기록지에 문장이 들어가게 한다.
  { key: "s_quilting", label: "Quilting suture 시행", type: "checkbox" },
  {
    key: "s_quilting_suture",
    label: "Quilting suture 봉합사",
    type: "text",
    default: "4-0 Vicryl",
  },
  {
    key: "s_splint_suture",
    label: "Splint 고정 봉합사",
    type: "text",
    default: "4-0 Vicryl",
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
  // Revision case(재수술)에서는 uncinectomy가 이전 수술에서 이미 되어 있을
  // 수도 있어서, 평소처럼(다른 부위 시행 시 자동 포함) 넘길 수 없다 —
  // 체크 여부를 직접 선택하게 한다(모식도에서 맨 위에, 기본 체크된 채로 노출).
  // 어느 쪽 ESS에 대한 재수술인지가 다를 수 있어(예: 우측만 재수술) 좌/우를
  // 각각의 플래그로 나눈다.
  { key: "f_revision_ess_right", label: "우측 ESS Revision case (재수술)", type: "checkbox" },
  { key: "f_revision_ess_left", label: "좌측 ESS Revision case (재수술)", type: "checkbox" },
  { key: "f_right_uncinectomy", label: "우측 - Uncinectomy", type: "checkbox" },
  { key: "f_left_uncinectomy", label: "좌측 - Uncinectomy", type: "checkbox" },
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
  { key: "dermacol", label: "Dermacol 도포", type: "checkbox", default: "true" },
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

// 특정 수술 종류에서만 다르게 적용할 default 값을 덮어쓴다 — 같은 필드
// 정의(예: CHR, P/E 시행 체크)를 여러 수술 종류가 공유하지만, 그 수술을
// 할 때 임상적으로 흔한/기본적인 값은 수술 종류마다 다르기 때문.
function withDefaults(fields: SurgeryFieldDef[], overrides: Record<string, string>): SurgeryFieldDef[] {
  return fields.map((f) => (f.key in overrides ? { ...f, default: overrides[f.key] } : f));
}

// ESS/병행은 비강소견 두 그룹(비중격/하비갑개 + ESS)을 모두 보여주고,
// 비중격교정술 단독은 비중격/하비갑개 그룹만 보여준다(ESS 전용 CT 소견 불필요).
// ESS/병행 수술명에는 항상 "ESS"가 들어가므로 ESS P/E도 기본으로 체크해둔다.
export const essFullFields: SurgeryFieldDef[] = withDefaults(
  [...nasalFindingFields, ...turbinoplastyFields, ...fessFields],
  { [ESS_PE_DONE_KEY]: "true" },
);
// 비중격교정술은 하비갑개 비후(CHR)를 양측에 동반하는 경우가 대부분이고,
// 양측 하비갑개 축소술까지 함께 시행하는 것("Septoturbinoplasty")이 기본
// 술식이라 관련 항목들을 기본으로 켜둔다. Packing 재료에서 Rhinocel/Dermacol은
// 쓰지 않아서(genSeptoplasty 참고) dermacol 항목 자체를 뺀다.
export const septoplastyFullFields: SurgeryFieldDef[] = withDefaults(
  [...septumTurbinateFindingFields, ...turbinoplastyFields, ...septoFields],
  {
    [SEPTO_PE_DONE_KEY]: "true",
    n_chr: "양측",
    turb_inferior_right: "true",
    turb_inferior_left: "true",
  },
).filter((f) => f.key !== "dermacol");
// 병행 수술명에는 항상 "Septoplasty"와 "ESS"가 함께 들어가므로 두 P/E를 모두
// 기본으로 체크해두고, 비중격교정술 단독과 마찬가지로 CHR도 양측 기본으로 켜둔다.
export const comboFullFields: SurgeryFieldDef[] = withDefaults(
  [...nasalFindingFields, ...turbinoplastyFields, ...septoFieldsForCombo, ...fessFieldsForCombo, ...comboOnlyFields],
  { [SEPTO_PE_DONE_KEY]: "true", [ESS_PE_DONE_KEY]: "true", n_chr: "양측" },
);

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
