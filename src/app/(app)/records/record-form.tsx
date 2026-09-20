"use client";

import { useActionState, useRef, useState } from "react";
import type { OpRecordFormState } from "@/app/actions/op-records";
import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
import { OpNoteGenerateButton } from "@/components/op-note-generate-button";
import {
  SeptumDiagram,
  SinusDiagram,
  getAnatomyVisibility,
  getSeptumCoveredKeys,
  getSinusCoveredKeys,
} from "@/components/anatomy-diagram";
import { PolypPicker, POLYP_FIELD_KEYS } from "@/components/polyp-picker";
import { EssFindingsPicker, ESS_FINDINGS_FIELD_KEYS } from "@/components/ess-findings-picker";
import { CollapsibleFindingSection } from "@/components/collapsible-finding-section";
import { UncinateAttachmentFields } from "@/components/uncinate-attachment-fields";
import { TurbinoplastyTypePicker, TURBINOPLASTY_FIELD_KEYS } from "@/components/turbinoplasty-type-picker";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";
import type { NameStyle } from "@/lib/op-note-generator";
import { buttonStyles } from "@/lib/ui";
import {
  isBuiltInSurgeryCode,
  isNasalFindingKey,
  SEPTUM_DETAIL_FIELD_KEYS,
  UNCINATE_FIELD_KEYS,
  SEPTO_PE_DONE_KEY,
  ESS_PE_DONE_KEY,
} from "@/lib/op-note-defs";

type Action = (
  state: OpRecordFormState | undefined,
  formData: FormData,
) => Promise<OpRecordFormState>;

// 집도의/보조의/진단명/합병증/출혈량/검체/술후계획 등 병원 EMR에 이미
// 저장되는 행정적 항목은 여기서 다시 받지 않는다 — 이 앱은 수술명/소견/
// 수술 과정처럼 자동 생성이 필요한 부분만 다룬다.
export interface RecordDefaultValues {
  operationDate: string;
  surgeonName: string;
  anesthesiaType: string;
  procedureName: string;
  findings: string;
  procedureDetail: string;
}

export function RecordForm({
  action,
  surgeryTypeCode,
  fields,
  fieldValues,
  defaultValues,
  nameStyle,
}: {
  action: Action;
  surgeryTypeCode: string;
  fields: SurgeryFieldDef[];
  fieldValues: FieldValues;
  defaultValues: RecordDefaultValues;
  nameStyle?: NameStyle;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState<1 | 2>(1);
  // f_revision_septo는 procedureFields 목록에서 숨겨진 채(hidden fallback
  // input으로) 실제 제출되고, 이 체크박스는 그 숨겨진 입력의 checked를 직접
  // 토글하는 트리거 역할만 한다 — SinusDiagram의 Revision 토글과 같은 방식.
  const revisionSeptoRef = useRef<HTMLLabelElement>(null);
  const [revisionSepto, setRevisionSepto] = useState<boolean>(() => fieldValues?.f_revision_septo === true);

  function toggleRevisionSepto() {
    const form = revisionSeptoRef.current?.closest("form");
    const el = form?.elements.namedItem("field_f_revision_septo");
    const nextVal = el instanceof HTMLInputElement ? !el.checked : !revisionSepto;
    if (el instanceof HTMLInputElement) el.checked = nextVal;
    setRevisionSepto(nextVal);
  }
  // 자동 생성을 지원하지 않는 커스텀 수술 종류는 검토할 초안 문구 자체가
  // 없으므로 세부 항목을 접어둘 이유가 없다 — 처음부터 펼쳐둔다.
  const [showDetails, setShowDetails] = useState(!isBuiltInSurgeryCode(surgeryTypeCode));

  const { showSeptum, showSinus } = getAnatomyVisibility(surgeryTypeCode);
  const nasalFields = fields.filter((f) => isNasalFindingKey(f.key));
  const procedureFields = fields.filter((f) => !isNasalFindingKey(f.key));

  const stepButtonClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium ${
      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-start justify-end gap-3">
        {state?.message && <p className="mt-2 text-sm text-red-600">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className={buttonStyles.primary}
        >
          {pending ? "저장 중..." : "기록 저장"}
        </button>
      </div>

      {/* 수술일은 환자 등록/수술 계획 단계에서 이미 입력받으므로 기록지에서
          다시 받지 않는다. 마취는 항상 전신마취(General)가 기본이라 선택
          없이 고정값으로 저장한다. 집도의도 병원 EMR에 이미 있고 대부분
          로그인한 본인이라 굳이 다시 입력받지 않고 기본값을 그대로 숨겨서
          저장한다. */}
      <input type="hidden" name="operationDate" defaultValue={defaultValues.operationDate} />
      <input type="hidden" name="anesthesiaType" defaultValue={defaultValues.anesthesiaType || "General"} />
      <input type="hidden" name="surgeonName" defaultValue={defaultValues.surgeonName} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          시행 수술명 (Procedure)
        </label>
        <input
          name="procedureName"
          defaultValue={defaultValues.procedureName}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          비강 소견 및 수술 과정 (Findings &amp; Procedure)
        </label>
        {/* 소견/과정을 굳이 서로 다른 칸에 나눠두면 병원 EMR 등 다른 곳에 옮겨
            적을 때 두 번 복사해야 해서, 한 칸에 이어서 보여주고 통째로
            복사·수정할 수 있게 한다. */}
        <textarea
          name="procedureDetail"
          defaultValue={[defaultValues.findings, defaultValues.procedureDetail].filter(Boolean).join("\n\n")}
          rows={14}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((s) => !s)}
        className="text-sm font-medium text-emerald-700 hover:underline"
      >
        {showDetails
          ? "▲ 세부 항목 접기"
          : "▼ 세부 항목 펼치기 (모식도/체크리스트로 다시 자동 작성하려면)"}
      </button>

      <div className={showDetails ? "space-y-4" : "hidden"}>
        {showSeptum && (
          <label
            ref={revisionSeptoRef}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
          >
            <input
              type="checkbox"
              checked={revisionSepto}
              onChange={toggleRevisionSepto}
              className="h-4 w-4 rounded border-slate-300"
            />
            Septoturbinoplasty Revision case (재수술)
          </label>
        )}
        <div className="flex gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={stepButtonClass(step === 1)}
          >
            1. 비강 소견
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={stepButtonClass(step === 2)}
          >
            2. 수술 방법
          </button>
        </div>

        <div className={step === 1 ? "space-y-4" : "hidden"}>
          {showSeptum && (
            <CollapsibleFindingSection
              doneKey={SEPTO_PE_DONE_KEY}
              label="Septoturbinoplasty P/E"
              values={fieldValues}
            >
              <SeptumDiagram values={fieldValues} />
              <SurgeryFieldInputs
                fields={nasalFields.filter((f) => SEPTUM_DETAIL_FIELD_KEYS.includes(f.key))}
                values={fieldValues}
              />
            </CollapsibleFindingSection>
          )}
          {showSinus && (
            <CollapsibleFindingSection doneKey={ESS_PE_DONE_KEY} label="ESS P/E" values={fieldValues}>
              <UncinateAttachmentFields
                fields={nasalFields.filter((f) => UNCINATE_FIELD_KEYS.includes(f.key))}
                values={fieldValues}
              />
              <EssFindingsPicker values={fieldValues} />
              <PolypPicker values={fieldValues} />
            </CollapsibleFindingSection>
          )}
          <SurgeryFieldInputs
            fields={nasalFields}
            values={fieldValues}
            excludeKeys={[
              ...getSeptumCoveredKeys(surgeryTypeCode),
              SEPTO_PE_DONE_KEY,
              ESS_PE_DONE_KEY,
              ...SEPTUM_DETAIL_FIELD_KEYS,
              ...UNCINATE_FIELD_KEYS,
              ...POLYP_FIELD_KEYS,
              ...ESS_FINDINGS_FIELD_KEYS,
            ]}
          />
        </div>

        <div className={step === 2 ? "space-y-4" : "hidden"}>
          {showSinus && <SinusDiagram values={fieldValues} />}
          <TurbinoplastyTypePicker values={fieldValues} />
          <SurgeryFieldInputs
            fields={procedureFields}
            values={fieldValues}
            excludeKeys={[...getSinusCoveredKeys(surgeryTypeCode), ...TURBINOPLASTY_FIELD_KEYS]}
          />
        </div>

        <OpNoteGenerateButton fields={fields} surgeryTypeCode={surgeryTypeCode} nameStyle={nameStyle} />
      </div>
    </form>
  );
}
