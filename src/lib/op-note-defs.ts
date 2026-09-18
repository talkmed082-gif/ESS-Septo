import type { SurgeryFieldDef } from "./field-types";

// 비강 소견(공통) — 비중격교정술 / FESS / 병행 모두에서 공유되는 항목
export const nasalFindingFields: SurgeryFieldDef[] = [
  {
    key: "n_dev_side",
    label: "비중격 편위 방향",
    type: "select",
    options: ["특이 만곡 없음", "좌측", "우측", "양측(C자형)"],
  },
  {
    key: "n_deviation",
    label: "비중격 만곡 정도",
    type: "select",
    options: ["해당없음", "경도", "중등도", "고도"],
  },
  {
    key: "n_cb",
    label: "Concha bullosa",
    type: "select",
    options: ["없음", "좌측", "우측", "양측"],
  },
  { key: "n_polyp_mm_left", label: "비용종 - 중비도(좌)", type: "checkbox" },
  { key: "n_polyp_mm_right", label: "비용종 - 중비도(우)", type: "checkbox" },
  { key: "n_polyp_ethmoid", label: "비용종 - 사골동", type: "checkbox" },
  { key: "n_polyp_maxillary", label: "비용종 - 상악동 자연공", type: "checkbox" },
  { key: "n_polyp_sphenoid", label: "비용종 - 접형동", type: "checkbox" },
  { key: "n_polyp_choana", label: "비용종 - 후비공까지 연장", type: "checkbox" },
  // Turbinoplasty — 비중격교정술/FESS 어느 쪽에도 단독 또는 동반될 수 있어 공통 항목으로 둠
  { key: "turb_middle_left", label: "중비갑개 축소술 - 좌측", type: "checkbox" },
  { key: "turb_middle_right", label: "중비갑개 축소술 - 우측", type: "checkbox" },
  { key: "turb_inferior_left", label: "하비갑개 축소술 - 좌측", type: "checkbox" },
  { key: "turb_inferior_right", label: "하비갑개 축소술 - 우측", type: "checkbox" },
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
    options: ["좌측 먼저 → 우측", "우측 먼저 → 좌측"],
  },
  ...fessStepFieldKeys.map((k) => ({
    key: `f_left_${k}`,
    label: `좌측 - ${fessStepLabels[k]}`,
    type: "checkbox" as const,
  })),
  ...fessStepFieldKeys.map((k) => ({
    key: `f_right_${k}`,
    label: `우측 - ${fessStepLabels[k]}`,
    type: "checkbox" as const,
  })),
  { key: "f_left_silastic_sheet", label: "좌측 - Silastic sheet 삽입 (유착 방지)", type: "checkbox" },
  { key: "f_right_silastic_sheet", label: "우측 - Silastic sheet 삽입 (유착 방지)", type: "checkbox" },
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
      "비중격 → 좌 FESS → 우 FESS",
      "비중격 → 우 FESS → 좌 FESS",
      "좌 FESS → 비중격 → 우 FESS",
      "우 FESS → 비중격 → 좌 FESS",
      "좌 FESS → 우 FESS → 비중격",
      "우 FESS → 좌 FESS → 비중격",
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
