"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
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
  REVISION_FLAG_KEYS,
  SINUSITIS_TO_FESS_FIELD,
  POLYP_TO_FESS_FIELD,
  POST_OP_FINISH_KEYS,
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

// 기존 수술 계획을 수정할 때 넘겨주는 초기 상태 — 넘기면 수술 종류는
// 고정 표시(변경 불가)되고, 저장은 action prop(예: updateOpPlan)으로 처리된다.
export interface EditPlanContext {
  surgeryTypeId: string;
  plannedDate: string;
  // 지금 폼에 채울 값 — 완료(DONE) 처리된 계획이면 planData와 actualData를
  // 합친 값(실제 시행 내역이 있으면 그걸 우선)이다.
  values: FieldValues;
  // 완료(DONE) 처리된 계획일 때만 넘어오는 "원래 계획값"(planData 그대로) —
  // Op Plan 표는 이후 수술 방법을 아무리 고쳐도 이 값만 보여줘서 원래 계획
  // 그대로 유지된다.
  frozenPlanValues?: FieldValues;
  isDone?: boolean;
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
  recordMeta?: { date: string; surgeonName: string },
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
  // 기록지 초안의 수술명 줄에는 수술 날짜와 집도의를 같이 적어서, 병원
  // EMR 등 다른 곳에 옮겨 적을 때 그대로 쓸 수 있게 한다.
  const nameLine = recordMeta
    ? `수술명 : ${recordMeta.date}${recordMeta.date ? " " : ""}${procedureName}${
        recordMeta.surgeonName ? ` by ${recordMeta.surgeonName}` : ""
      }`
    : `수술명: ${procedureName}`;
  return {
    planTable,
    recordText: `${nameLine}\n\n${findingsSection}[수술 과정]\n${record.procedureDetail}`,
  };
}

// 완료(DONE) 처리된 계획은 frozenPlanValues(원래 계획)가 넘어온다 — Op Plan
// 표는 이후 수술 방법을 고쳐도 항상 원래 계획의 절차 항목값을 그대로 보여줘야
// 하므로, 표를 만들 때만 그 값으로 덮어쓴다. 재수술 플래그는 병력에 가까워
// 예외로 두고 항상 최신값을 그대로 쓴다.
function proceduralFrozenOverrides(
  fields: SurgeryFieldDef[],
  frozenPlanValues: FieldValues | undefined,
): FieldValues | undefined {
  if (!frozenPlanValues) return undefined;
  const overrides = Object.fromEntries(
    fields
      .filter((f) => !isNasalFindingKey(f.key) && !(REVISION_FLAG_KEYS as readonly string[]).includes(f.key))
      .map((f) => [f.key, frozenPlanValues[f.key]])
      .filter(([, v]) => v !== undefined),
  );
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function buildTextsFrozenAware(
  code: string,
  fields: SurgeryFieldDef[],
  values: FieldValues,
  frozenPlanValues: FieldValues | undefined,
  anesthesiaType: string,
  nameStyle?: NameStyle,
  recordMeta?: { date: string; surgeonName: string },
): { planTable: PlanTable | null; recordText: string } {
  const overrides = proceduralFrozenOverrides(fields, frozenPlanValues);
  const planTableValues = overrides ? { ...values, ...overrides } : values;
  return {
    planTable: buildTexts(code, planTableValues, anesthesiaType, nameStyle).planTable,
    recordText: buildTexts(code, values, anesthesiaType, nameStyle, recordMeta).recordText,
  };
}

// 퀵 도구(비로그인 미리보기) · 새 환자 등록 · 기존 환자의 새 계획 작성을
// 한 컴포넌트로 통일한 것 — 예전엔 이 세 화면이 각각 따로 구현돼 있어서
// 필드/픽커 관련 기능을 추가할 때마다 세 곳을 다 고쳐야 했다. 이제는
// fixedPatient/loggedIn 조합으로 화면만 달라지고, 저장은 항상 같은
// createPatientWithPlan 액션 하나로 처리한다. fixedPatient가 없으면 항상
// 새 환자 등록 화면이다 — "새 환자 등록" 메뉴로 들어온 이상 기존 환자를
// 고를 이유가 없어서, 그 선택지 자체를 없앴다(기존 환자에 계획을 추가하는
// 건 해당 환자 상세 화면의 "새 계획" 쪽에서 fixedPatient로 처리한다).
export function SurgeryPlanner({
  surgeryTypes,
  loggedIn,
  nameStyle,
  userEmail,
  userName,
  fixedPatient,
  patientNasalFindings,
  editPlan,
  defaultView,
  action,
}: {
  surgeryTypes: SurgeryTypeOption[];
  loggedIn: boolean;
  nameStyle?: NameStyle;
  // 기록지 초안을 메일로 보낼 때 기본 수신자로 채운다.
  userEmail?: string;
  // 기록지 초안의 수술명 줄에 집도의로 채운다.
  userName?: string;
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
  // 기록지 초안 수술명 줄에 쓸 날짜 — 기본은 작성 당일이고, 저장된 계획을
  // 다시 열면 그때 저장해둔 날짜를 그대로 보여준다.
  const [surgeryDate, setSurgeryDate] = useState(
    () => editPlan?.plannedDate || new Date().toISOString().slice(0, 10),
  );
  const [{ planTable, recordText }, setTexts] = useState(() =>
    initialSelected
      ? buildTextsFrozenAware(
          initialSelected.code,
          initialSelected.fields,
          applyFieldDefaults(editPlan?.values ?? {}, initialSelected.fields),
          editPlan?.frozenPlanValues,
          "General",
          nameStyle,
          { date: editPlan?.plannedDate || new Date().toISOString().slice(0, 10), surgeonName: userName ?? "" },
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
  // 방금 applyCombo로 정한 값 — 화면(폼)이 그 값으로 다시 그려지기 전까지는 폼이
  // 옛 값을 들고 있어서, 그 사이에 연달아 들어온 클릭이 옛 값을 기준으로 계산되어
  // 앞선 클릭이 사라지는 문제가 있었다. 다시 그려진 뒤(templateKey가 바뀐 뒤)에
  // 비운다.
  const pendingValuesRef = useRef<FieldValues | null>(null);
  useEffect(() => {
    pendingValuesRef.current = null;
  }, [templateKey]);
  // ESS P/E 안의 세 상세 소견 그룹은 한꺼번에 다 펼쳐두면 체크박스가 너무
  // 많아서, "간략 소견"에서 체크한 그룹만 펼친다 — 기존에 값이 있으면(예:
  // 수정 화면) 처음부터 펼쳐서 보여준다.
  const [showAnatomicFindings, setShowAnatomicFindings] = useState(() =>
    ANATOMIC_RISK_PRESENT_KEYS.some((k) => templateValues?.[k] === true),
  );
  // 부비동염은 ESS 계획에서 워낙 흔히 관련돼 있어 기본으로 펼쳐둔다.
  const [showSinusitisFindings, setShowSinusitisFindings] = useState(true);
  const [showPolypFindings, setShowPolypFindings] = useState(() =>
    POLYP_FIELD_KEYS.some((k) => templateValues?.[k] === true),
  );
  // 이전 수술력도 대부분 해당 없는 경우라 기본은 숨겨두고, 체크해야 구체적인
  // 부위(Septo/Rt.ESS/Lt.ESS) 선택지가 열리게 한다 — 매번 체크박스 3개가
  // 항상 떠 있으면 재수술이 아닌 환자에게도 계속 헷갈렸다.
  const [showRevisionHistory, setShowRevisionHistory] = useState(
    () => REVISION_FLAG_KEYS.some((k) => templateValues?.[k] === true),
  );

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

  function computeTexts(values: FieldValues, dateOverride?: string): { planTable: PlanTable | null; recordText: string } {
    if (!selected) return { planTable: null, recordText: "" };
    return buildTextsFrozenAware(
      selected.code,
      selected.fields,
      values,
      editPlan?.frozenPlanValues,
      anesthesiaType,
      nameStyle,
      { date: dateOverride ?? surgeryDate, surgeonName: userName ?? "" },
    );
  }

  // 날짜 입력도 <form onChange={regenerateFromForm}>에 걸려서 바꾸면 change가
  // 버블링되는데, 그건 방금 바뀐 날짜 state를 아직 못 본 채로
  // regenerateFromForm이 실행돼(리렌더 전) 미리보기가 한 박자 늦게 바뀐다 —
  // 버블링을 막고 새 날짜를 직접 넘겨서 바로 반영한다.
  function handleSurgeryDateChange(e: ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    const next = e.target.value;
    setSurgeryDate(next);
    setTexts(computeTexts(templateValues ?? {}, next));
  }

  function readCurrentValues(): FieldValues | null {
    if (!selected || !formRef.current) return null;
    return pendingValuesRef.current ?? fieldValuesFromFormData(new FormData(formRef.current), selected.fields);
  }

  function regenerateFromForm() {
    const values = readCurrentValues();
    if (!values) return;
    setTexts(computeTexts(values));
  }

  function applyCombo(values: FieldValues) {
    pendingValuesRef.current = values;
    setTemplateValues(values);
    setTemplateKey((k) => k + 1);
    if (selected) setTexts(computeTexts(values));
  }

  // 간략 소견에서 그룹을 펼치는 건 그냥 화면 상태만 바꾸면 되지만, 접을
  // 때는 그 안의 체크박스들이 화면엔 안 보여도 폼에는 남아있지 않도록
  // 현재 폼 값을 읽어와서 해당 키들만 꺼서 applyCombo로 다시 반영한다.
  function setFindingGroupOpen(clearKeys: string[], open: boolean, setOpen: (v: boolean) => void) {
    setOpen(open);
    if (open || !selected || !formRef.current) return;
    const current = readCurrentValues();
    if (!current) return;
    const updated: FieldValues = { ...current };
    for (const key of clearKeys) updated[key] = false;
    applyCombo(updated);
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
    const current = readCurrentValues();
    if (!current) return;
    applyCombo({ ...current, [fieldKey]: !current[fieldKey] });
  }

  // 비강 소견(부비동염/비용종)에서 체크하면 그 부비동의 Op Plan 시행 부위도
  // 자동으로 같이 켜지고, 체크 해제하면 같이 꺼진다 — 비강 소견 -> Op Plan
  // -> 수술 방법 -> 수술 기록지까지 하나의 데이터(templateValues)로 이어져
  // 있어서, applyCombo로 한 번에 반영하면 넷 다 같이 갱신된다.
  function toggleFindingWithCascade(fieldKey: string, cascadeMap: Record<string, string>) {
    if (!selected || !formRef.current) return;
    const current = readCurrentValues();
    if (!current) return;
    const next = !current[fieldKey];
    const updated: FieldValues = { ...current, [fieldKey]: next };
    const fessKey = cascadeMap[fieldKey];
    if (fessKey) updated[fessKey] = next;
    applyCombo(updated);
  }

  // Op Plan 표에서도 한쪽 값을 반대쪽에 그대로 복사할 수 있게 한다 —
  // 표에 보이는 부위(sideMatrix 행)만 대상으로 한다.
  function copySideInTable(from: "f_left_" | "f_right_") {
    if (!selected || !formRef.current || !planTable?.sideMatrix) return;
    const to = from === "f_left_" ? "f_right_" : "f_left_";
    const current = readCurrentValues();
    if (!current) return;
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
    const current = readCurrentValues();
    if (!current) return;
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
    // 바로잡을 때 처음부터 다시 입력해야 해서 불편하다. 다만 지금 값이
    // "이전 종류의 default 그대로"인 필드(사용자가 실제로 건드리지 않은
    // 값)는 지워서 새 종류의 default(예: CHR 양측)가 다시 채워지게 한다 —
    // 안 그러면 ESS로 시작했다가 Septo로 바꿀 때 CHR이 ESS의 기본값
    // "없음"에 그대로 눌러앉아 있었다.
    const carried: FieldValues = { ...templateValues };
    for (const f of selected?.fields ?? []) {
      if (!f.default) continue;
      const defaultValue = f.type === "checkbox" ? f.default === "true" : f.default;
      if (carried[f.key] === defaultValue) delete carried[f.key];
    }
    const nextValues = next ? applyFieldDefaults(carried, next.fields) : undefined;
    setTemplateValues(nextValues);
    setTemplateKey((k) => k + 1);
    setTexts(
      next && nextValues
        ? buildTextsFrozenAware(
            next.code,
            next.fields,
            nextValues,
            editPlan?.frozenPlanValues,
            anesthesiaType,
            nameStyle,
            { date: surgeryDate, surgeonName: userName ?? "" },
          )
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

        {/* 첫 줄: 수술 전/후 상태 + 수술 종류(Septo/ESS) — 한눈에 보이게 컴팩트하게 묶는다. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {showPatientSection && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="planStatus" value="PLANNED" defaultChecked onChange={() => setView("pre")} />
                수술 전
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="planStatus" value="DONE" onChange={() => setView("post")} />
                수술 후
              </label>
            </div>
          )}
          <input type="hidden" name="surgeryTypeId" value={selectedId} />
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

        {customTypes.length > 0 && (
          <div>
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

        {showPatientSection && (
          <div className="space-y-3 rounded-md border border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">환자 이름</label>
                <input
                  name="name"
                  placeholder="비워두면 등록 날짜·시간으로 자동 생성"
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
          </div>
        )}


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
                <CollapsibleFindingSection doneKey={SEPTO_PE_DONE_KEY} label="Septoturbinoplasty P/E">
                  <SeptumDiagram values={templateValues} onChange={regenerateFromForm} />
                  <SurgeryFieldInputs
                    fields={nasalFields.filter((f) => SEPTUM_DETAIL_FIELD_KEYS.includes(f.key))}
                    values={templateValues}
                  />
                </CollapsibleFindingSection>
              )}
              {showSinus && (
                <CollapsibleFindingSection doneKey={ESS_PE_DONE_KEY} label="ESS P/E">
                  <UncinateAttachmentFields
                    fields={nasalFields.filter((f) => UNCINATE_FIELD_KEYS.includes(f.key))}
                    values={templateValues}
                    onChange={regenerateFromForm}
                  />
                  <NasalFindingsOverview
                    showAnatomic={showAnatomicFindings}
                    showSinusitis={showSinusitisFindings}
                    showPolyp={showPolypFindings}
                    onToggleAnatomic={(v) => setFindingGroupOpen(ANATOMIC_RISK_PRESENT_KEYS, v, setShowAnatomicFindings)}
                    onToggleSinusitis={(v) => setFindingGroupOpen(SINUSITIS_PRESENT_KEYS, v, setShowSinusitisFindings)}
                    onTogglePolyp={(v) => setFindingGroupOpen(POLYP_FIELD_KEYS, v, setShowPolypFindings)}
                  />
                  {showSinusitisFindings && (
                    <SinusitisFindingsPicker
                      values={templateValues}
                      onToggle={(key) => toggleFindingWithCascade(key, SINUSITIS_TO_FESS_FIELD)}
                    />
                  )}
                  {showPolypFindings && (
                    <PolypPicker
                      values={templateValues}
                      onToggle={(key) => toggleFindingWithCascade(key, POLYP_TO_FESS_FIELD)}
                    />
                  )}
                  {showAnatomicFindings && (
                    <AnatomicRiskFindingsPicker values={templateValues} onChange={regenerateFromForm} />
                  )}
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
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <input
                      type="checkbox"
                      checked={showRevisionHistory}
                      onChange={(e) =>
                        setFindingGroupOpen([...REVISION_FLAG_KEYS], e.target.checked, setShowRevisionHistory)
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    이전 수술력
                  </label>
                  {showRevisionHistory && (
                    <>
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
                      {planTable && (
                        <p className="text-xs text-slate-500">수술명: {planTable.procedureName}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className={view === "post" ? "space-y-4" : "hidden"}>
              <SurgeryFieldInputs
                fields={selected.fields.filter((f) => f.key === "f_side_order" || f.key === "c_order")}
                values={templateValues}
              />
              <SurgeryFieldInputs
                fields={selected.fields.filter((f) => f.key === "f_nav")}
                values={templateValues}
              />
              {showSinus && (
                <SinusDiagram values={templateValues} onChange={regenerateFromForm} hideRevisionToggle />
              )}
              {selected.code !== "SEPTOPLASTY" && (
                <TurbinoplastyTypePicker values={templateValues} onChange={regenerateFromForm} />
              )}
              {selected.fields.some((f) => POST_OP_FINISH_KEYS.includes(f.key)) && (
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">수술후 마무리</p>
                  <SurgeryFieldInputs
                    fields={selected.fields.filter((f) => POST_OP_FINISH_KEYS.includes(f.key))}
                    values={templateValues}
                  />
                </div>
              )}
              <SurgeryFieldInputs
                fields={procedureFields}
                values={templateValues}
                excludeKeys={[
                  ...getSinusCoveredKeys(selected.code),
                  ...TURBINOPLASTY_FIELD_KEYS,
                  "f_side_order",
                  "c_order",
                  "f_nav",
                  ...POST_OP_FINISH_KEYS,
                ]}
              />
              {/* Septoturbinoplasty는 기본이 양측 시행이라 좌우 복사 버튼이 불필요하고,
                  수술 순서상으로도 비중격 처치 다음에 하는 것이라 맨 아래에 둔다. */}
              {selected.code === "SEPTOPLASTY" && (
                <TurbinoplastyTypePicker values={templateValues} onChange={regenerateFromForm} hideCopyButtons />
              )}
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
                interactive={!editPlan?.isDone}
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
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-700">수술기록지 초안</h2>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  수술 날짜
                  <input
                    type="date"
                    name="plannedDate"
                    value={surgeryDate}
                    onChange={handleSurgeryDateChange}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <CopyButton text={recordText} />
                <a
                  href={`mailto:${encodeURIComponent(userEmail ?? "")}?subject=${encodeURIComponent(
                    `수술기록지${fixedPatient ? ` - ${fixedPatient.name}` : ""}`,
                  )}&body=${encodeURIComponent(recordText)}`}
                  className={buttonStyles.smallOutline}
                >
                  메일로 보내기
                </a>
              </div>
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

        {canSave ? (
          <div className="flex gap-2">
            <button type="submit" name="saveIntent" value="save" disabled={pending} className={`flex-1 ${buttonStyles.secondary}`}>
              {pending ? "저장 중..." : editPlan ? "저장" : fixedPatient ? "계획 저장" : "환자 등록 + 계획 저장"}
            </button>
            <button type="submit" name="saveIntent" value="record" disabled={pending} className={`flex-1 ${buttonStyles.primary}`}>
              {pending ? "저장 중..." : "저장 후 기록지 작성"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={regenerateFromForm} className={`w-full ${buttonStyles.accentOutline}`}>
            위 항목으로 미리보기 새로고침
          </button>
        )}
      </div>
    </form>
  );
}
