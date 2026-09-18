import type { SurgeryFieldDef } from "./field-types";

// 비강 소견(공통) — 비중격교정술 / FESS / 병행 모두에서 공유되는 항목
export const nasalFindingFields: SurgeryFieldDef[] = [
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
  {
    key: "n_cb",
    label: "Concha bullosa",
    type: "select",
    options: ["없음", "우측", "좌측", "양측"],
    default: "없음",
  },
  {
    key: "n_chr",
    label: "하비갑개 비후 (CHR, Chronic Hypertrophic Rhinitis)",
    type: "select",
    options: ["없음", "우측", "좌측", "양측"],
    default: "없음",
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
  // Skull base 높이(Keros classification) — 술전 CT로 평가, FESS 시 사골동
  // 천장 손상 위험도 판단에 참고. 좌우 비대칭 가능성이 있어 좌/우 각각 둠.
  // 기본값은 Keros 분류 중 실제로 가장 빈도가 높은 Type II로 둔다.
  {
    key: "skull_base_right",
    label: "Skull base 높이 - 우측 (Keros)",
    type: "select",
    options: ["Type I (얕음, 저위험)", "Type II (중등도)", "Type III (깊음, 고위험)"],
    default: "Type II (중등도)",
  },
  {
    key: "skull_base_left",
    label: "Skull base 높이 - 좌측 (Keros)",
    type: "select",
    options: ["Type I (얕음, 저위험)", "Type II (중등도)", "Type III (깊음, 고위험)"],
    default: "Type II (중등도)",
  },
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
  // 아래 항목들은 술전 CT에서 확인하는 해부학적 변이/위험 소견 — FESS 접근
  // 경로 계획 및 안전(안구·시신경·경동맥 손상 위험)에 직접 관련되어 함께 기록.
  {
    key: "n_onodi",
    label: "Onodi cell (접형사골동)",
    type: "select",
    options: ["없음", "우측", "좌측", "양측"],
    default: "없음",
  },
  {
    key: "n_haller",
    label: "Haller cell (안하사골봉소)",
    type: "select",
    options: ["없음", "우측", "좌측", "양측"],
    default: "없음",
  },
  // Lamina papyracea 결손 — ethmoidectomy 시 안구 손상과 직결되는, 가장
  // 흔하고 실제로 중요한 골 결손 소견 (시신경/경동맥 결손과는 별도로 기록)
  {
    key: "n_lp_dehiscence",
    label: "Lamina papyracea 결손",
    type: "select",
    options: ["없음", "우측", "좌측", "양측"],
    default: "없음",
  },
  {
    key: "n_dehiscence",
    label: "시신경/경동맥 골 결손 (Optic nerve/ICA dehiscence)",
    type: "select",
    options: ["없음", "우측", "좌측", "양측"],
    default: "없음",
  },
  // Turbinoplasty — 비중격교정술/FESS 어느 쪽에도 단독 또는 동반될 수 있어 공통 항목으로 둠
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
  { key: "s_debrider", label: "Microdebrider 사용", type: "checkbox" },
  { key: "s_splint", label: "Silastic splint 삽입", type: "checkbox" },
  {
    key: "s_pack",
    label: "비강 Packing",
    type: "select",
    options: ["Merocel", "Nasopore", "Vaseline gauze"],
  },
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
  { key: "f_right_silastic_sheet", label: "우측 - Silastic sheet 삽입 (유착 방지)", type: "checkbox" },
  { key: "f_left_silastic_sheet", label: "좌측 - Silastic sheet 삽입 (유착 방지)", type: "checkbox" },
  { key: "f_nav", label: "Navigation(항법장치) 병용", type: "checkbox" },
  { key: "f_debrider", label: "Microdebrider 사용", type: "checkbox" },
  {
    key: "f_pack",
    label: "비강 Packing",
    type: "select",
    options: ["Nasopore", "Merocel", "Gelfoam"],
  },
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
  {
    key: "c_pack",
    label: "마지막 비강 Packing (양측 공통, 종료 시 1회)",
    type: "select",
    options: ["Nasopore", "Merocel", "Gelfoam"],
  },
];

const septoFieldsForCombo = septoFields.filter((f) => f.key !== "s_pack");
const fessFieldsForCombo = fessFields.filter((f) => f.key !== "f_pack");

export const essFullFields: SurgeryFieldDef[] = [...nasalFindingFields, ...fessFields];
export const septoplastyFullFields: SurgeryFieldDef[] = [...nasalFindingFields, ...septoFields];
export const comboFullFields: SurgeryFieldDef[] = [
  ...nasalFindingFields,
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
