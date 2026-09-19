"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import {
  createPatientWithPlan,
  type PatientPlanFormState,
} from "@/app/actions/patient-plan";
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
import { PresetBar, type PresetItem } from "@/components/preset-bar";
import type { RecentCombo } from "@/lib/recent-combos";
import { PlanTableView } from "@/components/plan-table";
import { fieldValuesFromFormData, type FieldValues, type SurgeryFieldDef } from "@/lib/field-types";
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // 클립보드 접근 불가 - 무시
        }
      }}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
    >
      {copied ? "복사됨 ✓" : "복사"}
    </button>
  );
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
  presetsByType,
  recentCombosByType,
  existingPatients,
  fixedPatient,
  patientNasalFindings,
}: {
  surgeryTypes: SurgeryTypeOption[];
  loggedIn: boolean;
  nameStyle?: NameStyle;
  presetsByType?: Record<string, PresetItem[]>;
  recentCombosByType?: Record<string, RecentCombo[]>;
  existingPatients?: ExistingPatientOption[];
  fixedPatient?: { id: string; name: string };
  patientNasalFindings?: FieldValues;
}) {
  const [state, formAction, pending] = useActionState<
    PatientPlanFormState | undefined,
    FormData
  >(createPatientWithPlan, undefined);

  const first = surgeryTypes[0];
  const [selectedId, setSelectedId] = useState(first?.id ?? "");
  // 마취는 항상 전신마취(General)가 기본이라 별도 선택 없이 고정한다.
  const anesthesiaType = "General";
  const [patientMode, setPatientMode] = useState<"new" | "existing">("new");
  const [{ planTable, recordText }, setTexts] = useState(() =>
    first ? buildTexts(first.code, {}, "General", nameStyle) : { planTable: null, recordText: "" },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [templateValues, setTemplateValues] = useState<FieldValues | undefined>(undefined);
  const [templateKey, setTemplateKey] = useState(0);

  if (!first) {
    return <p className="text-sm text-slate-500">등록된 수술 종류가 없습니다.</p>;
  }

  const selected = surgeryTypes.find((st) => st.id === selectedId);
  const presets = selected ? presetsByType?.[selected.id] ?? [] : [];
  const recentCombos = selected ? recentCombosByType?.[selected.id] ?? [] : [];
  const nasalFields = selected ? selected.fields.filter((f) => isNasalFindingKey(f.key)) : [];
  const procedureFields = selected ? selected.fields.filter((f) => !isNasalFindingKey(f.key)) : [];
  const { showSeptum, showSinus } = selected
    ? getAnatomyVisibility(selected.code)
    : { showSeptum: false, showSinus: false };
  const stepButtonClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium ${
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

  function handleSurgeryTypeChange(id: string) {
    setSelectedId(id);
    setTemplateValues(undefined);
    setTemplateKey((k) => k + 1);
    const next = surgeryTypes.find((st) => st.id === id);
    setTexts(next ? buildTexts(next.code, {}, anesthesiaType, nameStyle) : { planTable: null, recordText: "" });
  }

  const showPatientSection = loggedIn && !fixedPatient;
  const canSave = loggedIn;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form ref={formRef} action={formAction} onChange={regenerateFromForm} className="space-y-4">
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">생년월일</label>
                    <input
                      type="date"
                      name="birthDate"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">메모</label>
                  <textarea
                    name="memo"
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">수술 종류</label>
          <select
            name="surgeryTypeId"
            value={selectedId}
            onChange={(e) => handleSurgeryTypeChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {!fixedPatient && <option value="">계획은 나중에 작성 (환자만 등록)</option>}
            {surgeryTypes.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">수술 예정일</label>
            <input
              type="date"
              name="plannedDate"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        )}

        {selected && loggedIn && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">술전 진단명</label>
            <input
              name="diagnosis"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        )}

        {selected && (
          <div key={`${selected.id}-${templateKey}`} className="space-y-4">
            {loggedIn && (
              <PresetBar
                surgeryTypeId={selected.id}
                fields={selected.fields}
                initialPresets={presets}
                formRef={formRef}
                onApply={applyCombo}
              />
            )}
            {recentCombos.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-500">최근 사용한 조합</p>
                <div className="flex flex-wrap gap-2">
                  {recentCombos.map((combo, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyCombo(combo.values)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
                    >
                      {combo.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {patientNasalFindings && Object.keys(patientNasalFindings).length > 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="mb-2 text-xs font-medium text-emerald-700">
                  이 환자의 이전 기록에 비강/영상 소견이 저장되어 있습니다
                </p>
                <button
                  type="button"
                  onClick={applyPatientNasalFindings}
                  className="rounded-full border border-emerald-600 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  저장된 비강/영상 소견 불러오기
                </button>
              </div>
            )}
            <div className="flex gap-2 border-b border-slate-200 pb-3">
              <button type="button" onClick={() => setStep(1)} className={stepButtonClass(step === 1)}>
                1. 비강/영상 소견
              </button>
              <button type="button" onClick={() => setStep(2)} className={stepButtonClass(step === 2)}>
                2. 수술 방법
              </button>
            </div>
            <div className={step === 1 ? "space-y-4" : "hidden"}>
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
                  <SurgeryFieldInputs
                    fields={nasalFields.filter((f) => UNCINATE_FIELD_KEYS.includes(f.key))}
                    values={templateValues}
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
            </div>
            <div className={step === 2 ? "space-y-4" : "hidden"}>
              {showSinus && <SinusDiagram values={templateValues} onChange={regenerateFromForm} />}
              <SurgeryFieldInputs
                fields={procedureFields}
                values={templateValues}
                excludeKeys={getSinusCoveredKeys(selected.code)}
              />
            </div>
          </div>
        )}

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
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pending ? "저장 중..." : fixedPatient || patientMode === "existing" ? "계획 저장" : "환자 등록 + 계획 저장"}
          </button>
        ) : (
          <button
            type="button"
            onClick={regenerateFromForm}
            className="w-full rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            위 항목으로 미리보기 새로고침
          </button>
        )}
      </form>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Op Plan 요약</h2>
            {planTable && <CopyButton text={planTableToText(planTable)} />}
          </div>
          {planTable ? (
            <PlanTableView table={planTable} interactive onToggle={toggleFessField} />
          ) : (
            <p className="text-sm text-slate-500">수술 종류를 선택하면 여기에 요약이 표시됩니다.</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">수술기록지 초안</h2>
            <CopyButton text={recordText} />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{recordText}</pre>
        </div>
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
  );
}
