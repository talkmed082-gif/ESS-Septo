"use client";

import { useActionState, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { createPatientWithPlan } from "@/app/actions/patient-plan";
import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
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
import { PlanTableView } from "@/components/plan-table";
import { CopyButton } from "@/components/copy-button";
import { buttonStyles } from "@/lib/ui";
import {
  applyFieldDefaults,
  fieldValuesFromFormData,
  type FieldValues,
  type SurgeryFieldDef,
} from "@/lib/field-types";
import {
  isBuiltInSurgeryCode,
  isNasalFindingKey,
  SEPTUM_DETAIL_FIELD_KEYS,
  UNCINATE_FIELD_KEYS,
  SEPTO_PE_DONE_KEY,
  ESS_PE_DONE_KEY,
} from "@/lib/op-note-defs";
import {
  buildProcedureName,
  buildPlanTable,
  planTableToText,
  generateOpNote,
  type NameStyle,
  type PlanTable,
} from "@/lib/op-note-generator";

export interface SurgeryTypeOption {
  id: string;
  code: string;
  name: string;
  fields: SurgeryFieldDef[];
}

export interface ExistingPatientOption {
  id: string;
  name: string;
  chartNo: string | null;
}

// 기존 수술 계획을 수정할 때 넘겨주는 초기 상태 — 넘기면 수술 종류는
// 고정 표시(변경 불가)되고, 저장은 action prop(예: updateOpPlan)으로 처리된다.
export interface EditPlanContext {
  surgeryTypeId: string;
  plannedDate: string;
  values: FieldValues;
}

export interface SurgeryPlannerFormState {
  errors?: Record<string, string[]>;
  message?: string;
}

type SurgeryPlannerAction = (
  state: SurgeryPlannerFormState | undefined,
  formData: FormData,
) => Promise<SurgeryPlannerFormState>;

function buildTexts(
  code: string,
  values: FieldValues,
  anesthesiaType: string,
  nameStyle?: NameStyle,
): { planTable: PlanTable | null; recordText: string } {
  if (!isBuiltInSurgeryCode(code)) {
    return {
      planTable: null,
      recordText: "이 수술 종류는 자동 작성을 지원하지 않습니다.",
    };
  }
  const planTable = buildPlanTable(code, values, nameStyle);
  const record = generateOpNote(code, values, "record", anesthesiaType);
  const procedureName = buildProcedureName(code, values, nameStyle);
  const findingsSection = record.findings ? `[수술 소견]\n${record.findings}\n\n` : "";
  return {
    planTable,
    recordText: `수술명: ${procedureName}\n\n${findingsSection}[수술 과정]\n${record.procedureDetail}`,
  };
}

// 퀵 도구(비로그인 미리보기) · 새 환자 등록 · 기존 환자의 새 계획 작성을
// 한 컴포넌트로 통일한 것 — 예전엔 이 세 화면이 각각 따로 구현돼 있어서
// 필드/픽커 관련 기능을 추가할 때마다 세 곳을 다 고쳐야 했다. 이제는
// fixedPatient/existingPatients/loggedIn 조합으로 화면만 달라지고,
// 저장은 항상 같은 createPatientWithPlan 액션 하나로 처리한다.
export function SurgeryPlanner({
  surgeryTypes,
  loggedIn,
  nameStyle,
  existingPatients,
  fixedPatient,
  patientNasalFindings,
  editPlan,
  defaultView,
  action,
}: {
  surgeryTypes: SurgeryTypeOption[];
  loggedIn: boolean;
  nameStyle?: NameStyle;
  existingPatients?: ExistingPatientOption[];
  fixedPatient?: { id: string; name: string };
  patientNasalFindings?: FieldValues;
  // 기존 계획 수정 모드 — 넘기면 수술 종류가 고정되고 값들이 미리 채워진다.
  editPlan?: EditPlanContext;
  // 화면을 "수술 전"(비강 소견 + Op Plan 요약)과 "수술 후"(수술 방법 +
  // 수술기록지)로 나눠서 보여줄 때, 어느 쪽을 기본으로 열지 — 보통 계획의
  // 완료 여부(OpPlan.status)에 맞춰 호출하는 쪽에서 정해서 넘겨준다.
  defaultView?: "pre" | "post";
  // 저장 시 호출할 서버 액션 — 생략하면 새 환자+계획 생성(createPatientWithPlan).
  // 계획 수정 시엔 updateOpPlan.bind(null, planId)처럼 넘긴다.
  action?: SurgeryPlannerAction;
}) {
  const [state, formAction, pending] = useActionState<
    SurgeryPlannerFormState | undefined,
    FormData
  >(action ?? createPatientWithPlan, undefined);

  const first = surgeryTypes[0];
  const initialSelected = editPlan
    ? surgeryTypes.find((st) => st.id === editPlan.surgeryTypeId)
    : first;
  const [selectedId, setSelectedId] = useState(initialSelected?.id ?? first?.id ?? "");
  // 마취는 항상 전신마취(General)가 기본이라 별도 선택 없이 고정한다.
  const anesthesiaType = "General";
  const [patientMode, setPatientMode] = useState<"new" | "existing">("new");
  const [{ planTable, recordText }, setTexts] = useState(() =>
    initialSelected
      ? buildTexts(
          initialSelected.code,
          applyFieldDefaults(editPlan?.values ?? {}, initialSelected.fields),
          "General",
          nameStyle,
        )
      : { planTable: null, recordText: "" },
  );
  const formRef = useRef<HTMLFormElement>(null);
  // "수술 전" 화면(비강 소견 입력 + Op Plan 요약)과 "수술 후" 화면(수술 방법
  // 입력 + 수술기록지 초안)을 하나의 토글로 오간다 — 계획이 완료 상태면
  // 수술 후 화면을 기본으로 열어서, 매번 수동으로 넘길 필요가 없게 한다.
  const [view, setView] = useState<"pre" | "post">(defaultView ?? "pre");
  // 필드 default(예: Septoturbinoplasty P/E 기본 체크, CHR 양측 등)가 실제
  // 체크박스/선택값에도 바로 반영되도록, 초기값에도 applyFieldDefaults를
  // 거친다 — 그냥 editPlan?.values(빈 값)만 넘기면 CollapsibleFindingSection
  // 등 controlled 입력들이 죄다 "선택 안 됨" 상태로 시작해 default가 무시된다.
  const [templateValues, setTemplateValues] = useState<FieldValues | undefined>(() =>
    initialSelected ? applyFieldDefaults(editPlan?.values ?? {}, initialSelected.fields) : editPlan?.values,
  );
  const [templateKey, setTemplateKey] = useState(0);

  if (!first) {
    return <p className="text-sm text-slate-500">등록된 수술 종류가 없습니다.</p>;
  }

  const selected = surgeryTypes.find((st) => st.id === selectedId);
  // 기본 3종(ESS/비중격교정술/병행)은 체크박스 두 개(Septo/ESS)의 조합으로
  // 고르게 하고, 사용자가 직접 추가한 커스텀 수술 종류는 그 아래 별도
  // 목록(단일 선택)으로 남겨둔다 — 둘을 억지로 같은 체크박스 방식에 넣으면
  // 커스텀끼리, 또는 커스텀과 기본 3종 사이의 조합 규칙이 애매해진다.
  const septoType = surgeryTypes.find((st) => st.code === "SEPTOPLASTY");
  const essType = surgeryTypes.find((st) => st.code === "ESS");
  const comboType = surgeryTypes.find((st) => st.code === "COMBO");
  const customTypes = surgeryTypes.filter((st) => !isBuiltInSurgeryCode(st.code));
  const isCustomSelected = selected ? !isBuiltInSurgeryCode(selected.code) : false;
  const septoChecked = selected?.code === "SEPTOPLASTY" || selected?.code === "COMBO";
  const essChecked = selected?.code === "ESS" || selected?.code === "COMBO";
  function idForBuiltInCombo(nextSepto: boolean, nextEss: boolean): string {
    if (nextSepto && nextEss) return comboType?.id ?? "";
    if (nextSepto) return septoType?.id ?? "";
    if (nextEss) return essType?.id ?? "";
    return "";
  }
  const nasalFields = selected ? selected.fields.filter((f) => isNasalFindingKey(f.key)) : [];
  const procedureFields = selected ? selected.fields.filter((f) => !isNasalFindingKey(f.key)) : [];
  const { showSeptum, showSinus } = selected
    ? getAnatomyVisibility(selected.code)
    : { showSeptum: false, showSinus: false };
  const viewButtonClass = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium ${
      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  function regenerateFromForm() {
    if (!selected || !formRef.current) return;
    const values = fieldValuesFromFormData(new FormData(formRef.current), selected.fields);
    setTexts(buildTexts(selected.code, values, anesthesiaType, nameStyle));
  }

  function applyCombo(values: FieldValues) {
    setTemplateValues(values);
    setTemplateKey((k) => k + 1);
    if (selected) setTexts(buildTexts(selected.code, values, anesthesiaType, nameStyle));
  }

  function applyPatientNasalFindings() {
    if (!patientNasalFindings) return;
    applyCombo({ ...templateValues, ...patientNasalFindings });
  }

  // Op Plan 표의 FESS 시행 부위 체크마크를 직접 클릭했을 때 — 현재 폼 값을
  // 읽어서 그 필드만 뒤집고, applyCombo와 같은 방식으로 모식도 등 다른 입력
  // 컴포넌트도 새 값으로 다시 마운트시켜 상태가 어긋나지 않게 한다.
  function toggleFessField(fieldKey: string) {
    if (!selected || !formRef.current) return;
    const current = fieldValuesFromFormData(new FormData(formRef.current), selected.fields);
    applyCombo({ ...current, [fieldKey]: !current[fieldKey] });
  }

  // Op Plan 표에서도 한쪽 값을 반대쪽에 그대로 복사할 수 있게 한다 —
  // 표에 보이는 부위(sideMatrix 행)만 대상으로 한다.
  function copySideInTable(from: "f_left_" | "f_right_") {
    if (!selected || !formRef.current || !planTable?.sideMatrix) return;
    const to = from === "f_left_" ? "f_right_" : "f_left_";
    const current = fieldValuesFromFormData(new FormData(formRef.current), selected.fields);
    const updated: FieldValues = { ...current };
    for (const row of planTable.sideMatrix.rows) {
      updated[`${to}${row.key}`] = current[`${from}${row.key}`];
    }
    applyCombo(updated);
  }

  // Revision case(재수술)를 "수술 방법" 탭 안 모식도까지 들어가야만 보이던
  // 것을 탭과 무관하게 항상 보이는 곳으로 빼서 계획 화면에서 바로 설정할
  // 수 있게 한다. 어느 부위(Septoturbinoplasty/우측 ESS/좌측 ESS)의
  // revision인지 각각 켤 수 있고, ESS 쪽을 켤 때는 그 side의 uncinectomy도
  // 기본으로 체크해준다(모식도의 기존 동작과 동일) — applyCombo로 다시
  // 마운트시켜 모식도가 새 값을 그대로 반영하게 한다.
  function toggleRevisionFlag(
    key: "f_revision_septo" | "f_revision_ess_right" | "f_revision_ess_left",
    e?: ChangeEvent<HTMLInputElement>,
  ) {
    // 이 체크박스가 <form onChange={regenerateFromForm}> 안에 있어서, 클릭하면
    // change 이벤트가 폼까지 버블링되어 regenerateFromForm도 같이 실행된다.
    // 문제는 그게 이 함수보다 "나중에" 실행되는데, 이 함수가 이미 리마운트를
    // 예약(setTemplateKey)한 뒤라서 — regenerateFromForm은 아직 리마운트 전의
    // 옛 DOM 값을 읽어 미리보기를 옛 상태로 덮어써 버린다. 그 결과 Revision을
    // 해제해도 미리보기에는 여전히 켜져 있던 것처럼 보이는 버그가 났다.
    // 버블링을 막아 regenerateFromForm이 중복 실행되지 않게 한다.
    e?.stopPropagation();
    if (!selected || !formRef.current) return;
    const current = fieldValuesFromFormData(new FormData(formRef.current), selected.fields);
    const next = !(current[key] === true);
    const updated: FieldValues = { ...current, [key]: next };
    if (next && key === "f_revision_ess_right") updated.f_right_uncinectomy = true;
    if (next && key === "f_revision_ess_left") updated.f_left_uncinectomy = true;
    applyCombo(updated);
  }

  function handleSurgeryTypeChange(id: string, e?: ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    // 이 select도 <form onChange={regenerateFromForm}> 안에 있어서, 바뀌면
    // change 이벤트가 폼까지 버블링된다. 아래 setTexts로 이미 새 수술
    // 종류에 맞는 올바른 미리보기를 계산해뒀는데, regenerateFromForm이 뒤이어
    // (아직 리마운트 전이라 옛 수술 종류의 필드가 남아있는) DOM을 다시 읽어
    // 그 값으로 덮어써 버려서 한 박자 늦게(옛 내용이 잠깐 보였다가) 바뀌는
    // 것처럼 보였다. 버블링을 막아 중복 실행을 방지한다.
    e?.stopPropagation();
    setSelectedId(id);
    const next = surgeryTypes.find((st) => st.id === id);
    // 이전 종류에서 이미 입력해둔 값(겹치는 키, 예: 비강 소견/turbinoplasty)은
    // 그대로 유지하고, 새 종류에만 있는 필드는 default로 채운다 — 종류를
    // 바꿨다고 이미 적어둔 소견까지 통째로 날아가면 계획 수정 중 종류를
    // 바로잡을 때 처음부터 다시 입력해야 해서 불편하다.
    const nextValues = next ? applyFieldDefaults({ ...templateValues }, next.fields) : undefined;
    setTemplateValues(nextValues);
    setTemplateKey((k) => k + 1);
    setTexts(
      next && nextValues
        ? buildTexts(next.code, nextValues, anesthesiaType, nameStyle)
        : { planTable: null, recordText: "" },
    );
  }

  const showPatientSection = loggedIn && !fixedPatient;
  const canSave = loggedIn;

  return (
    <form ref={formRef} action={formAction} onChange={regenerateFromForm}>
      <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {fixedPatient && <input type="hidden" name="existingPatientId" value={fixedPatient.id} />}

        {fixedPatient && (
          <p className="text-sm text-slate-500">
            환자: <span className="font-medium text-slate-900">{fixedPatient.name}</span>
          </p>
        )}

        {showPatientSection && (
          <div className="space-y-3 rounded-md border border-slate-200 p-4">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="patientMode"
                  checked={patientMode === "new"}
                  onChange={() => setPatientMode("new")}
                />
                새 환자 등록
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="patientMode"
                  checked={patientMode === "existing"}
                  onChange={() => setPatientMode("existing")}
                />
                기존 환자 선택
              </label>
            </div>

            {patientMode === "existing" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">환자</label>
                <select
                  name="existingPatientId"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  {(existingPatients ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.chartNo ? ` (${p.chartNo})` : ""}
                    </option>
                  ))}
                </select>
                {(existingPatients ?? []).length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">등록된 환자가 없습니다.</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">환자 이름 *</label>
                    <input
                      name="name"
                      required
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                    {state?.errors?.name && (
                      <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">차트번호</label>
                    <input
                      name="chartNo"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">성별</label>
                    <select
                      name="sex"
                      defaultValue=""
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="">선택 안 함</option>
                      <option value="M">남</option>
                      <option value="F">여</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">나이</label>
                    <input
                      type="number"
                      name="age"
                      min="0"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">환자 상태</label>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="planStatus"
                        value="PLANNED"
                        defaultChecked
                        onChange={() => setView("pre")}
                      />
                      수술 전 환자
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="planStatus"
                        value="DONE"
                        onChange={() => setView("post")}
                      />
                      수술 후 환자
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">수술 종류</label>
          <input type="hidden" name="surgeryTypeId" value={selectedId} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-700">
            {septoType && (
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={septoChecked}
                  onChange={(e) => handleSurgeryTypeChange(idForBuiltInCombo(e.target.checked, essChecked), e)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Septo
              </label>
            )}
            {essType && (
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={essChecked}
                  onChange={(e) => handleSurgeryTypeChange(idForBuiltInCombo(septoChecked, e.target.checked), e)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                ESS
              </label>
            )}
          </div>
          {!fixedPatient && !editPlan && !septoChecked && !essChecked && !isCustomSelected && (
            <p className="mt-1 text-xs text-slate-400">체크하지 않으면 계획 없이 환자만 등록됩니다.</p>
          )}
          {customTypes.length > 0 && (
            <div className="mt-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">기타 수술 종류</label>
              <select
                value={isCustomSelected ? selectedId : ""}
                onChange={(e) => handleSurgeryTypeChange(e.target.value, e)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
                <option value="">선택 안 함</option>
                {customTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {editPlan && (
            <p className="mt-1 text-xs text-slate-400">
              종류를 바꾸면 그 종류의 입력 항목으로 다시 표시됩니다. 겹치는 항목(비강 소견 등)은 유지되고,
              새 종류에 없는 값은 사라집니다.
            </p>
          )}
        </div>


        {/* 수술 예정일은 병원 EMR 스케줄과 겹치는 행정 항목이라 화면에서 입력
            받지 않는다. 이미 저장된 계획을 수정할 때는(editPlan) 기존 값을
            그대로 숨겨서 다시 제출해 값이 지워지지 않게 하고, 새로 만드는
            계획은 날짜 없이 생성된다. */}
        {editPlan && <input type="hidden" name="plannedDate" defaultValue={editPlan.plannedDate} />}

        {selected && (
          <div key={`${selected.id}-${templateKey}`} className="space-y-4">
            {patientNasalFindings && Object.keys(patientNasalFindings).length > 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="mb-2 text-xs font-medium text-emerald-700">
                  이 환자의 이전 기록에 비강 소견이 저장되어 있습니다
                </p>
                <button
                  type="button"
                  onClick={applyPatientNasalFindings}
                  className="rounded-full border border-emerald-600 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  저장된 비강 소견 불러오기
                </button>
              </div>
            )}
            <div className="flex gap-2 border-b border-slate-200 pb-3">
              <button type="button" onClick={() => setView("pre")} className={viewButtonClass(view === "pre")}>
                수술 전 (비강 소견 · Op Plan)
              </button>
              <button type="button" onClick={() => setView("post")} className={viewButtonClass(view === "post")}>
                수술 후 (수술 방법 · 기록지)
              </button>
            </div>
            <div className={view === "pre" ? "space-y-4" : "hidden"}>
              {showSeptum && (
                <CollapsibleFindingSection
                  doneKey={SEPTO_PE_DONE_KEY}
                  label="Septoturbinoplasty P/E"
                  values={templateValues}
                  onChange={regenerateFromForm}
                >
                  <SeptumDiagram values={templateValues} onChange={regenerateFromForm} />
                  <SurgeryFieldInputs
                    fields={nasalFields.filter((f) => SEPTUM_DETAIL_FIELD_KEYS.includes(f.key))}
                    values={templateValues}
                  />
                </CollapsibleFindingSection>
              )}
              {showSinus && (
                <CollapsibleFindingSection
                  doneKey={ESS_PE_DONE_KEY}
                  label="ESS P/E"
                  values={templateValues}
                  onChange={regenerateFromForm}
                >
                  <UncinateAttachmentFields
                    fields={nasalFields.filter((f) => UNCINATE_FIELD_KEYS.includes(f.key))}
                    values={templateValues}
                    onChange={regenerateFromForm}
                  />
                  <EssFindingsPicker values={templateValues} onChange={regenerateFromForm} />
                  <PolypPicker values={templateValues} onChange={regenerateFromForm} />
                </CollapsibleFindingSection>
              )}
              <SurgeryFieldInputs
                fields={nasalFields}
                values={templateValues}
                excludeKeys={[
                  ...getSeptumCoveredKeys(selected.code),
                  SEPTO_PE_DONE_KEY,
                  ESS_PE_DONE_KEY,
                  ...SEPTUM_DETAIL_FIELD_KEYS,
                  ...UNCINATE_FIELD_KEYS,
                  ...POLYP_FIELD_KEYS,
                  ...ESS_FINDINGS_FIELD_KEYS,
                ]}
              />
              {(showSeptum || showSinus) && (
                <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500">
                    이전 수술력 — 해당하는 부위를 선택하세요
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-700">
                    {showSeptum && (
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={templateValues?.f_revision_septo === true}
                          onChange={(e) => toggleRevisionFlag("f_revision_septo", e)}
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
                            checked={templateValues?.f_revision_ess_right === true}
                            onChange={(e) => toggleRevisionFlag("f_revision_ess_right", e)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Rt. ESS
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={templateValues?.f_revision_ess_left === true}
                            onChange={(e) => toggleRevisionFlag("f_revision_ess_left", e)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Lt. ESS
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className={view === "post" ? "space-y-4" : "hidden"}>
              {showSinus && (
                <SinusDiagram values={templateValues} onChange={regenerateFromForm} hideRevisionToggle />
              )}
              <TurbinoplastyTypePicker values={templateValues} onChange={regenerateFromForm} />
              <SurgeryFieldInputs
                fields={procedureFields}
                values={templateValues}
                excludeKeys={[...getSinusCoveredKeys(selected.code), ...TURBINOPLASTY_FIELD_KEYS]}
              />
            </div>
          </div>
        )}

      </div>

      <div className="space-y-4">
        {view === "pre" && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Op Plan 요약</h2>
              {planTable && <CopyButton text={planTableToText(planTable)} />}
            </div>
            {planTable ? (
              <PlanTableView
                table={planTable}
                interactive
                onToggle={toggleFessField}
                onCopySide={copySideInTable}
              />
            ) : (
              <p className="text-sm text-slate-500">수술 종류를 선택하면 여기에 요약이 표시됩니다.</p>
            )}
          </div>
        )}
        {view === "post" && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">수술기록지 초안</h2>
              <CopyButton text={recordText} />
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{recordText}</pre>
          </div>
        )}
        <p className="text-xs text-slate-500">
          자동 생성된 초안입니다. 실제 소견에 맞게 검토 후 사용해주세요.
          {!loggedIn && (
            <>
              {" "}
              환자 기록으로 저장하려면{" "}
              <Link href="/signup" className="underline">
                회원가입
              </Link>{" "}
              또는{" "}
              <Link href="/login" className="underline">
                로그인
              </Link>{" "}
              후 이용해주세요.
            </>
          )}
        </p>
      </div>
      </div>

      <div className="mt-6 space-y-3">
        {selected && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">계획 메모</label>
            <textarea
              name="planNote"
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        )}

        {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
        {state?.errors?.name && patientMode === "existing" && (
          <p className="text-sm text-red-600">{state.errors.name[0]}</p>
        )}

        {canSave ? (
          <button type="submit" disabled={pending} className={`w-full ${buttonStyles.primary}`}>
            {pending
              ? "저장 중..."
              : editPlan
                ? "저장"
                : fixedPatient || patientMode === "existing"
                  ? "계획 저장"
                  : "환자 등록 + 계획 저장"}
          </button>
        ) : (
          <button type="button" onClick={regenerateFromForm} className={`w-full ${buttonStyles.accentOutline}`}>
            위 항목으로 미리보기 새로고침
          </button>
        )}
      </div>
    </form>
  );
}
