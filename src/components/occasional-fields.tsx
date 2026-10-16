import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";
import { hasOccasionalChecked, occasionalFields } from "@/lib/op-note-defs";

// 수술 후 화면의 "특이사항 (가끔 하는 것)" — 평소엔 접어 두고, 체크된 게 있으면 펼친다.
// 접혀 있어도 입력은 폼 안에 있어서 값이 그대로 저장된다.
export function OccasionalFields({ fields, values }: { fields: SurgeryFieldDef[]; values?: FieldValues }) {
  const list = occasionalFields(fields);
  if (list.length === 0) return null;
  return (
    <details open={hasOccasionalChecked(values)} className="rounded-md border border-dashed border-slate-300 p-3">
      <summary className="text-sm font-medium text-slate-600">특이사항 (가끔 하는 것)</summary>
      <div className="mt-2">
        <SurgeryFieldInputs fields={list} values={values} />
      </div>
    </details>
  );
}
