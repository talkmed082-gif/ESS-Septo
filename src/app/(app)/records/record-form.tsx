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
import {
  AnatomicRiskFindingsPicker,
  SinusitisFindingsPicker,
  ANATOMIC_RISK_PRESENT_KEYS,
  SINUSITIS_PRESENT_KEYS,
  ESS_FINDINGS_FIELD_KEYS,
} from "@/components/ess-findings-picker";
import { NasalFindingsOverview } from "@/components/nasal-findings-overview";
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
  POST_OP_FINISH_KEYS,
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
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  // ESS P/E 안의 세 상세 소견 그룹은 한꺼번에 다 펼치면 체크박스가 너무
  // 많아서, "간략 소견"에서 체크한 그룹만 펼친다. 그룹을 접을 때 실제 DOM
  // 체크박스도 같이 꺼야 해서(defaultChecked는 리마운트 전까진 값이 안
  // 바뀜) fieldValues의 사본을 따로 들고 있다가 갱신한다.
  const [liveFieldValues, setLiveFieldValues] = useState<FieldValues>(fieldValues);
  const [showAnatomicFindings, setShowAnatomicFindings] = useState(() =>
    ANATOMIC_RISK_PRESENT_KEYS.some((k) => fieldValues?.[k] === true),
  );
  const [showSinusitisFindings, setShowSinusitisFindings] = useState(() =>
    SINUSITIS_PRESENT_KEYS.some((k) => fieldValues?.[k] === true),
  );
  const [showPolypFindings, setShowPolypFindings] = useState(() =>
    POLYP_FIELD_KEYS.some((k) => fieldValues?.[k] === true),
  );

  function setFindingGroupOpen(clearKeys: string[], open: boolean, setOpen: (v: boolean) => void) {
    setOpen(open);
    if (open) return;
    setLiveFieldValues((v) => {
      const updated = { ...v };
      for (const key of clearKeys) updated[key] = false;
      return updated;
    });
    const form = formRef.current;
    for (const key of clearKeys) {
      const el = form?.elements.namedItem(`field_${key}`);
      if (el instanceof HTMLInputElement) el.checked = false;
    }
  }

  // Op Plan 표와 같은 모양(SideMatrixTable)으로 통일한 부비동염/비용종
  // 표는 자체 상태 없이 이 값을 그대로 받아 그리므로, 클릭 시 DOM과
  // liveFieldValues를 함께 갱신해줘야 화면에 반영된다.
  function toggleLiveField(key: string) {
    const el = formRef.current?.elements.namedItem(`field_${key}`);
    const next = el instanceof HTMLInputElement ? !el.checked : !(liveFieldValues[key] === true);
    if (el instanceof HTMLInputElement) el.checked = next;
    setLiveFieldValues((v) => ({ ...v, [key]: next }));
  }
  // f_revision_septo/f_revision_ess_right/f_revision_ess_left는 procedureFields
  // 목록에서 숨겨진 채(hidden fallback input으로) 실제 제출되고, 이 체크박스들은
  // 그 숨겨진 입력의 checked를 직접 토글하는 트리거 역할만 한다 —
  // SinusDiagram의 Revision 토글과 같은 방식.
  const [revisionFlags, setRevisionFlags] = useState<Record<string, boolean>>(() => ({
    f_revision_septo: fieldValues?.f_revision_septo === true,
    f_revision_ess_right: fieldValues?.f_revision_ess_right === true,
    f_revision_ess_left: fieldValues?.f_revision_ess_left === true,
  }));

  function toggleRevisionFlag(key: string) {
    const el = formRef.current?.elements.namedItem(`field_${key}`);
    const nextVal = el instanceof HTMLInputElement ? !el.checked : !revisionFlags[key];
    if (el instanceof HTMLInputElement) el.checked = nextVal;
    setRevisionFlags((r) => ({ ...r, [key]: nextVal }));
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
    <form ref={formRef} action={formAction} className="space-y-4">
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

      {(showSeptum || showSinus) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          <span className="text-xs font-medium text-slate-500">이전 수술력</span>
          {showSeptum && (
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={revisionFlags.f_revision_septo}
                onChange={() => toggleRevisionFlag("f_revision_septo")}
                className="h-4 w-4 rounded border-slate-300"
              />
              Septoturbinoplasty
            </label>
          )}
          {showSinus && (
            <>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={revisionFlags.f_revision_ess_right}
                  onChange={() => toggleRevisionFlag("f_revision_ess_right")}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Rt. ESS
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={revisionFlags.f_revision_ess_left}
                  onChange={() => toggleRevisionFlag("f_revision_ess_left")}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Lt. ESS
              </label>
            </>
          )}
        </div>
      )}

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
            <CollapsibleFindingSection doneKey={SEPTO_PE_DONE_KEY} label="Septoturbinoplasty P/E">
              <SeptumDiagram values={liveFieldValues} />
              <SurgeryFieldInputs
                fields={nasalFields.filter((f) => SEPTUM_DETAIL_FIELD_KEYS.includes(f.key))}
                values={liveFieldValues}
              />
            </CollapsibleFindingSection>
          )}
          {showSinus && (
            <CollapsibleFindingSection doneKey={ESS_PE_DONE_KEY} label="ESS P/E">
              <UncinateAttachmentFields
                fields={nasalFields.filter((f) => UNCINATE_FIELD_KEYS.includes(f.key))}
                values={liveFieldValues}
              />
              <NasalFindingsOverview
                showAnatomic={showAnatomicFindings}
                showSinusitis={showSinusitisFindings}
                showPolyp={showPolypFindings}
                onToggleAnatomic={(v) => setFindingGroupOpen(ANATOMIC_RISK_PRESENT_KEYS, v, setShowAnatomicFindings)}
                onToggleSinusitis={(v) => setFindingGroupOpen(SINUSITIS_PRESENT_KEYS, v, setShowSinusitisFindings)}
                onTogglePolyp={(v) => setFindingGroupOpen(POLYP_FIELD_KEYS, v, setShowPolypFindings)}
              />
              {showAnatomicFindings && <AnatomicRiskFindingsPicker values={liveFieldValues} />}
              {showSinusitisFindings && (
                <SinusitisFindingsPicker values={liveFieldValues} onToggle={toggleLiveField} />
              )}
              {showPolypFindings && <PolypPicker values={liveFieldValues} onToggle={toggleLiveField} />}
            </CollapsibleFindingSection>
          )}
          <SurgeryFieldInputs
            fields={nasalFields}
            values={liveFieldValues}
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
          <SurgeryFieldInputs
            fields={fields.filter((f) => f.key === "f_side_order" || f.key === "c_order")}
            values={liveFieldValues}
          />
          <SurgeryFieldInputs fields={fields.filter((f) => f.key === "f_nav")} values={liveFieldValues} />
          {showSinus && <SinusDiagram values={liveFieldValues} />}
          {surgeryTypeCode !== "SEPTOPLASTY" && <TurbinoplastyTypePicker values={liveFieldValues} />}
          {fields.some((f) => POST_OP_FINISH_KEYS.includes(f.key)) && (
            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">수술후 마무리</p>
              <SurgeryFieldInputs
                fields={fields.filter((f) => POST_OP_FINISH_KEYS.includes(f.key))}
                values={liveFieldValues}
              />
            </div>
          )}
          <SurgeryFieldInputs
            fields={procedureFields}
            values={liveFieldValues}
            excludeKeys={[
              ...getSinusCoveredKeys(surgeryTypeCode),
              ...TURBINOPLASTY_FIELD_KEYS,
              "f_side_order",
              "c_order",
              "f_nav",
              ...POST_OP_FINISH_KEYS,
            ]}
          />
          {/* Septoturbinoplasty는 기본이 양측 시행이라 좌우 복사 버튼이 불필요하고,
              수술 순서상으로도 비중격 처치 다음에 하는 것이라 맨 아래에 둔다. */}
          {surgeryTypeCode === "SEPTOPLASTY" && (
            <TurbinoplastyTypePicker values={liveFieldValues} hideCopyButtons />
          )}
        </div>

        <OpNoteGenerateButton fields={fields} surgeryTypeCode={surgeryTypeCode} nameStyle={nameStyle} />
      </div>

      <button type="submit" disabled={pending} className={`w-full ${buttonStyles.primary}`}>
        {pending ? "저장 중..." : "기록 저장"}
      </button>
    </form>
  );
}
