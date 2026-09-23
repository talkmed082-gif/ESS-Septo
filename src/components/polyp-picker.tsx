"use client";

import type { FieldValues } from "@/lib/field-types";
import type { PlanSideMatrixRow } from "@/lib/op-note-generator";
import { SideMatrixTable } from "@/components/plan-table";

const POLYP_SITE_FIELDS = [
  { key: "site_mm", label: "중비도" },
  { key: "site_ethmoid", label: "사골동" },
  { key: "site_maxillary", label: "상악동 자연공" },
  { key: "site_sphenoid", label: "접형동" },
  { key: "site_choana", label: "후비공까지 연장" },
] as const;

// 모식도(AnatomyPicker)와 마찬가지로 이 컴포넌트가 대신 입력을 담당하는 필드 —
// SurgeryFieldInputs 목록에서는 제외하고 여기서만 선택하게 한다.
export const POLYP_FIELD_KEYS = POLYP_SITE_FIELDS.flatMap((f) => [
  `n_polyp_right_${f.key}`,
  `n_polyp_left_${f.key}`,
]);

// Op Plan의 FESS 시행 부위 표와 같은 2칸(우측/좌측) 표 모양으로 통일한다 —
// 자체 상태 없이 상위가 넘겨주는 값을 그대로 그리고, 클릭은 onToggle로
// 그대로 올려보낸다(상위가 cascade 등 추가 처리를 담당).
export function PolypPicker({
  values,
  interactive = true,
  onToggle,
}: {
  values?: FieldValues;
  interactive?: boolean;
  onToggle?: (fieldKey: string) => void;
}) {
  const rows: PlanSideMatrixRow[] = POLYP_SITE_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    right: values?.[`n_polyp_right_${f.key}`] === true,
    left: values?.[`n_polyp_left_${f.key}`] === true,
    rightFieldKey: `n_polyp_right_${f.key}`,
    leftFieldKey: `n_polyp_left_${f.key}`,
  }));
  return (
    <SideMatrixTable title="비용종(Polyp) 위치" rows={rows} interactive={interactive} onToggle={onToggle} />
  );
}
