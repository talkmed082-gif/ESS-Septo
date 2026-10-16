"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
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
import { CcInput } from "@/components/cc-input";
import { useUnsavedChangesWarning } from "@/components/use-unsaved-changes-warning";
import { hasDsnValue, DSN_NO_DEGREE, DSN_NO_SIDE } from "@/components/dsn-sync";
import { buttonStyles } from "@/lib/ui";
import { peSideCopyPatch } from "@/lib/pe-side-copy";
import { buildRemarkText, remarkExtras } from "@/lib/remark";
import { localTodayStr } from "@/lib/date-format";
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
  DSN_FIELD_KEYS,
  DSN_SIDE_KEY,
  SEPTO_BASE_SET,
  comboOrderForDsn,
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
  planNote?: string;
  chiefComplaint?: string;
  postOpRemark?: string;
}

export interface TextTemplateOption {
  id: string;
  title: string;
  body: string;
}

// 템플릿은 이미 쓴 내용을 지우지 않고 끝에 빈 줄 하나를 두고 붙인다
export function appendTemplate(current: string, body: string): string {
  return current.trim() ? `${current.replace(/\s+$/, "")}\n\n${body}` : body;
}

// "템플릿 넣기" — 고르면 onPick 후 다시 안내 문구로 돌아간다(같은 템플릿을 또 넣을 수 있게)
function TemplatePicker({ templates, onPick }: { templates: TextTemplateOption[]; onPick: (body: string) => void }) {
  if (templates.length === 0) return null;
  return (
    <select
      value=""
      aria-label="템플릿 넣기"
      onChange={(e) => {
        // 폼 전체 onChange(기록지 초안 재계산)로 퍼지지 않게 막는다.
        e.stopPropagation();
        const t = templates.find((x) => x.id === e.target.value);
        if (t) onPick(t.body);
      }}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600"
    >
      <option value="">템플릿 넣기…</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title}
        </option>
      ))}
    </select>
  );
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
): { planTable: PlanTable | null; recordText: string; procedureName: string } {
  if (!isBuiltInSurgeryCode(code)) {
    return {
      planTable: null,
      recordText: "이 수술 종류는 자동 작성을 지원하지 않습니다.",
      procedureName: "",
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
    procedureName,
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
): { planTable: PlanTable | null; recordText: string; procedureName: string } {
  const overrides = proceduralFrozenOverrides(fields, frozenPlanValues);
  const planTableValues = overrides ? { ...values, ...overrides } : values;
  // 기록지/remark의 수술명은 실제 시행 값(values) 기준이라 기록지 쪽 결과를 그대로 쓴다.
  const record = buildTexts(code, values, anesthesiaType, nameStyle, recordMeta);
  return {
    planTable: buildTexts(code, planTableValues, anesthesiaType, nameStyle).planTable,
    recordText: record.recordText,
    procedureName: record.procedureName,
  };
}

// 병행 수술인데 순서가 아직 없으면 P/E(DSN 방향)로 정한 기본 순서를 넣는다.
function withComboOrder(code: string, values: FieldValues): FieldValues {
  if (code !== "COMBO" || (typeof values.c_order === "string" && values.c_order)) return values;
  return { ...values, c_order: comboOrderForDsn(values[DSN_SIDE_KEY]) };
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
  templates = [],
  heading,
  headerActions,
  silasticReminder,
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
  // 내 문구 템플릿(설정에서 관리) — 계획 메모·수술 후 특이사항 칸에 골라 넣는다
  templates?: TextTemplateOption[];
  // 계획 화면 맨 윗줄 — 환자 이름 제목과 버튼들. 수술 종류·날짜와 같은 줄에 놓는다(사용자 2026-10-16).
  heading?: ReactNode;
  headerActions?: ReactNode;
  // Silastic을 넣으면 수술 후 화면에서 제거 리마인더(수술일+7일)를 버튼 하나로 만든다(사용자 2026-10-16)
  silasticReminder?: { exists: boolean; add: (surgeryDate: string) => Promise<{ ok?: boolean; message?: string }> };
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
  // 수술 날짜 — 저장된 계획은 그 날짜를, 새 계획은 빈 값(미정)으로 시작한다.
  // 예전엔 오늘 날짜를 기본으로 채워서, 며칠 뒤 수술을 미리 계획하면 날짜를 안
  // 고친 채 저장돼 엉뚱한 날짜가 기록지·remark·캘린더에 들어갔다.
  const [surgeryDate, setSurgeryDate] = useState(() => editPlan?.plannedDate ?? "");
  const [{ planTable, recordText, procedureName }, setTexts] = useState(() =>
    initialSelected
      ? buildTextsFrozenAware(
          initialSelected.code,
          initialSelected.fields,
          applyFieldDefaults(editPlan?.values ?? {}, initialSelected.fields),
          editPlan?.frozenPlanValues,
          "General",
          nameStyle,
          { date: editPlan?.plannedDate ?? "", surgeonName: userName ?? "" },
        )
      : { planTable: null, recordText: "", procedureName: "" },
  );
  // 차트 remark용 — CC(주호소)는 수술 전에, 특이사항은 수술 후에 적고, 둘을
  // 수술명과 함께 묶어 한 번에 복사한다.
  const [chiefComplaint, setChiefComplaint] = useState(editPlan?.chiefComplaint ?? "");
  const [silasticState, setSilasticState] = useState<{ done: boolean; message?: string }>({
    done: silasticReminder?.exists ?? false,
  });
  const [silasticPending, startSilastic] = useTransition();
  const [postOpRemark, setPostOpRemark] = useState(editPlan?.postOpRemark ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const planNoteRef = useRef<HTMLTextAreaElement>(null);
  // 모바일에선 Op Plan 요약/기록지 초안이 긴 입력 폼 아래에 있어서, 하단 저장
  // 줄의 "요약 보기" 버튼으로 바로 내려갈 수 있게 한다.
  const previewRef = useRef<HTMLDivElement>(null);
  // 입력을 바꾼 뒤 저장하지 않고 떠나면 경고한다 — 제출하면 다시 끈다.
  const [dirty, setDirty] = useState(false);
  // 저장을 누르면 경고를 끄는데(성공하면 다른 화면으로 넘어가므로), 저장이 실패해
  // 이 화면에 오류와 함께 남으면 입력은 아직 저장 안 된 상태라 경고를 다시 켠다 —
  // 저장 실패 때만 state가 새로 바뀌므로(성공하면 redirect), 누를 때의 state와
  // 달라졌으면 실패로 본다.
  const [stateAtSubmit, setStateAtSubmit] = useState(state);
  useUnsavedChangesWarning(loggedIn && (dirty || state !== stateAtSubmit));
  // "수술 전" 화면(비강 소견 입력 + Op Plan 요약)과 "수술 후" 화면(수술 방법
  // 입력 + 수술기록지 초안)을 하나의 토글로 오간다 — 계획이 완료 상태면
  // 수술 후 화면을 기본으로 열어서, 매번 수동으로 넘길 필요가 없게 한다.
  const [view, setView] = useState<"pre" | "post">(defaultView ?? "pre");
  // 필드 default(예: Septoturbinoplasty P/E 기본 체크, CHR 양측 등)가 실제
  // 체크박스/선택값에도 바로 반영되도록, 초기값에도 applyFieldDefaults를
  // 거친다 — 그냥 editPlan?.values(빈 값)만 넘기면 CollapsibleFindingSection
  // 등 controlled 입력들이 죄다 "선택 안 됨" 상태로 시작해 default가 무시된다.
  const [templateValues, setTemplateValues] = useState<FieldValues | undefined>(() =>
    initialSelected
      ? withComboOrder(initialSelected.code, applyFieldDefaults(editPlan?.values ?? {}, initialSelected.fields))
      : editPlan?.values,
  );
  // P/E의 DSN 방향이 바뀌었을 때만 수술 순서를 따라 바꾸려고 마지막으로 본 방향을 기억한다 —
  // 순서를 손으로 바꾼 뒤에도 DSN을 안 건드리면 그 순서를 그대로 둔다.
  const lastDevSideRef = useRef<unknown>(templateValues?.[DSN_SIDE_KEY]);
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
    ANATOMIC_RISK_PRESENT_KEYS.some((k) => templateValues?.[k] === true) || hasDsnValue(templateValues),
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

  function computeTexts(
    values: FieldValues,
    dateOverride?: string,
  ): { planTable: PlanTable | null; recordText: string; procedureName: string } {
    if (!selected) return { planTable: null, recordText: "", procedureName: "" };
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
  // 수술 전/후 화면은 보이는 쪽의 입력만 그린다(안 보이는 쪽까지 탭마다 다시 그리지
  // 않도록). 그래서 화면을 바꿀 때 폼의 최신 값을 읽어서 새로 그려지는 쪽에 넘긴다.
  function changeView(next: "pre" | "post") {
    if (next !== view) {
      const current = readCurrentValues();
      if (current) {
        setTemplateValues(current);
        setTexts(computeTexts(current));
      }
    }
    setView(next);
  }

  function changeSurgeryDate(next: string) {
    setDirty(true);
    setSurgeryDate(next);
    setTexts(computeTexts(readCurrentValues() ?? templateValues ?? {}, next));
  }

  function handleSurgeryDateChange(e: ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    changeSurgeryDate(e.target.value);
  }

  function readCurrentValues(): FieldValues | null {
    if (!selected || !formRef.current) return null;
    return pendingValuesRef.current ?? fieldValuesFromFormData(new FormData(formRef.current), selected.fields);
  }

  function regenerateFromForm() {
    setDirty(true);
    const values = readCurrentValues();
    if (!values) return;
    const orderPatch = followDsnOrder(values);
    if (orderPatch) {
      writeToForm(orderPatch);
      const updated = { ...values, ...orderPatch };
      setTemplateValues(updated);
      setTexts(computeTexts(updated));
      return;
    }
    setTexts(computeTexts(values));
  }

  // P/E → 수술 순서 한 방향만 잇는다: DSN 방향이 바뀐 경우에만 병행 순서를 넓은 쪽 ESS →
  // 비중격 → 좁은 쪽 ESS로 다시 맞춘다. 순서를 바꿔도 P/E는 그대로다.
  function followDsnOrder(values: FieldValues): Record<string, string> | null {
    const dev = values[DSN_SIDE_KEY];
    if (dev === lastDevSideRef.current) return null;
    lastDevSideRef.current = dev;
    if (selected?.code !== "COMBO") return null;
    const order = comboOrderForDsn(dev);
    return values.c_order === order ? null : { c_order: order };
  }

  function writeToForm(patch: Record<string, boolean | string>) {
    if (!formRef.current) return;
    for (const [key, value] of Object.entries(patch)) {
      // 같은 이름의 입력이 여럿(보이는 select + 숨은 입력)일 수 있어 전부 맞춘다.
      for (const el of formRef.current.querySelectorAll(`[name="field_${key}"]`)) {
        if (el instanceof HTMLInputElement && typeof value === "boolean") el.checked = value;
        else if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) el.value = String(value);
      }
    }
  }

  // 체크박스 몇 개만 바꿀 때 쓴다. applyCombo와 달리 영역 전체를 다시 만들지
  // 않고(templateKey를 올리지 않고) 폼의 숨은 체크박스를 직접 바꾼 뒤 상태만
  // 갱신한다 — 전체를 다시 만들면 방금 누른 버튼이 화면에서 사라져서, 폰에서
  // 연달아 탭할 때 다음 탭이 사라진 버튼에 전달되어 씹히는 문제가 있었다.
  function patchFieldValues(patch: Record<string, boolean | string>) {
    const current = readCurrentValues();
    if (!current || !formRef.current) return;
    setDirty(true);
    const merged: FieldValues = { ...current, ...patch };
    const full = { ...patch, ...(followDsnOrder(merged) ?? {}) };
    writeToForm(full);
    const updated: FieldValues = { ...current, ...full };
    setTemplateValues(updated);
    setTexts(computeTexts(updated));
  }

  function applyCombo(input: FieldValues) {
    const values = { ...input, ...(followDsnOrder(input) ?? {}) };
    setDirty(true);
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
    const patch: Record<string, boolean | string> = {};
    for (const key of clearKeys) patch[key] = false;
    // DSN은 Septo와 공유하는 값이라, ESS만 기록할 때에만 함께 지운다.
    if (clearKeys === ANATOMIC_RISK_PRESENT_KEYS && !showSeptum) {
      patch.n_dev_side = DSN_NO_SIDE;
      patch.n_deviation = DSN_NO_DEGREE;
    }
    patchFieldValues(patch);
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
    patchFieldValues({ [fieldKey]: !current[fieldKey] });
  }

  // 비강 소견(부비동염/비용종)에서 체크하면 그 부비동의 Op Plan 시행 부위도
  // 자동으로 같이 켜진다 — 비강 소견 -> Op Plan -> 수술 방법 -> 수술 기록지까지
  // 하나의 데이터(templateValues)로 이어져 있다. 끌 때는 같은 시행 부위를
  // 가리키는 다른 소견(예: 같은 부비동의 비용종)이 남아 있으면 시행 부위를 그대로
  // 둔다 — 예전엔 부비동염만 꺼도 비용종 때문에 필요한 MMA까지 같이 꺼졌다.
  function toggleFindingWithCascade(fieldKey: string, cascadeMap: Record<string, string>) {
    if (!selected || !formRef.current) return;
    const current = readCurrentValues();
    if (!current) return;
    const next = !current[fieldKey];
    const patch: Record<string, boolean> = { [fieldKey]: next };
    const fessKey = cascadeMap[fieldKey];
    if (fessKey) {
      const otherSupport = Object.entries({ ...SINUSITIS_TO_FESS_FIELD, ...POLYP_TO_FESS_FIELD }).some(
        ([findingKey, target]) => findingKey !== fieldKey && target === fessKey && current[findingKey] === true,
      );
      if (next || !otherSupport) patch[fessKey] = next;
    }
    patchFieldValues(patch);
  }

  // P/E 소견(부비동염·폴립 위치·UP attach)의 한쪽 값을 반대쪽에 그대로 복사한다.
  // 수술 방법(ESS 단계)은 건드리지 않는다 — 그건 아래 표의 좌우 복사로 따로 한다.
  function copyPeSide(from: "right" | "left") {
    if (!selected || !formRef.current) return;
    const current = readCurrentValues();
    if (!current) return;
    // 소견 선택 화면 일부는 처음 값으로 자기 상태를 잡아 두므로 영역을 새 값으로 다시 그린다
    applyCombo({ ...current, ...peSideCopyPatch(nasalFields.map((f) => f.key), current, from) });
  }

  // Op Plan 표에서도 한쪽 값을 반대쪽에 그대로 복사할 수 있게 한다 —
  // 표에 보이는 부위(sideMatrix 행)만 대상으로 한다.
  function copySideInTable(from: "f_left_" | "f_right_") {
    if (!selected || !formRef.current || !planTable?.sideMatrix) return;
    const to = from === "f_left_" ? "f_right_" : "f_left_";
    const current = readCurrentValues();
    if (!current) return;
    const patch: Record<string, boolean> = {};
    for (const row of planTable.sideMatrix.rows) {
      patch[`${to}${row.key}`] = current[`${from}${row.key}`] === true;
    }
    patchFieldValues(patch);
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
    const patch: Record<string, boolean> = { [key]: next };
    if (next && key === "f_revision_ess_right") patch.f_right_uncinectomy = true;
    if (next && key === "f_revision_ess_left") patch.f_left_uncinectomy = true;
    patchFieldValues(patch);
  }

  function handleSurgeryTypeChange(
    id: string,
    e?: ChangeEvent<HTMLSelectElement | HTMLInputElement>,
    // 이미 있던 값보다 우선해서 켤 값 — Septo를 새로 켜면 Septoturbinoplasty 기본 세트
    forced?: Record<string, boolean>,
  ) {
    // 이 select도 <form onChange={regenerateFromForm}> 안에 있어서, 바뀌면
    // change 이벤트가 폼까지 버블링된다. 아래 setTexts로 이미 새 수술
    // 종류에 맞는 올바른 미리보기를 계산해뒀는데, regenerateFromForm이 뒤이어
    // (아직 리마운트 전이라 옛 수술 종류의 필드가 남아있는) DOM을 다시 읽어
    // 그 값으로 덮어써 버려서 한 박자 늦게(옛 내용이 잠깐 보였다가) 바뀌는
    // 것처럼 보였다. 버블링을 막아 중복 실행을 방지한다.
    e?.stopPropagation();
    setDirty(true);
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
    const nextValues = next
      ? withComboOrder(
          next.code,
          applyFieldDefaults(
            {
              ...carried,
              // 새 종류에 있는 항목만(Septo 단독엔 f_silastic_sheet가 없다)
              ...Object.fromEntries(Object.entries(forced ?? {}).filter(([k]) => next.fields.some((f) => f.key === k))),
            },
            next.fields,
          ),
        )
      : undefined;
    lastDevSideRef.current = nextValues?.[DSN_SIDE_KEY];
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
        : { planTable: null, recordText: "", procedureName: "" },
    );
  }

  const showPatientSection = loggedIn && !fixedPatient;
  const canSave = loggedIn;
  const remarkText = buildRemarkText({
    chiefComplaint,
    surgeryDate,
    // 자동 수술명을 못 만드는 커스텀 수술 종류는 종류 이름으로 대신한다.
    procedureName: procedureName || selected?.name,
    postOpRemark,
    extras: remarkExtras(templateValues),
  });

  return (
    <form ref={formRef} action={formAction} onChange={regenerateFromForm} onSubmit={() => {
        setDirty(false);
        setStateAtSubmit(state);
      }}>
      {/* 맨 윗줄: 환자 이름 + 수술 종류·날짜 + 버튼, 그 아래 수술 전/후 탭(사용자 2026-10-16) */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {heading}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              {showPatientSection && (
                // 아래 "수술 전/후" 탭은 보는 화면만 바꾸고, 이건 저장될 계획 상태라
                // 이름을 다르게 둔다(같은 이름이 두 군데 있어 헷갈렸다).
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">상태</span>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="planStatus" value="PLANNED" defaultChecked onChange={() => changeView("pre")} />
                    예정
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="planStatus"
                      value="DONE"
                      onChange={(e) => {
                        changeView("post");
                        // 이미 끝난 수술을 등록하는 경우라 날짜가 비어 있으면 오늘로 채운다.
                        // 폼 onChange는 아직 빈 날짜를 보고 초안을 다시 덮어쓰므로 막는다.
                        if (!surgeryDate) {
                          e.stopPropagation();
                          changeSurgeryDate(localTodayStr());
                        }
                      }}
                    />
                    완료
                  </label>
                </div>
              )}
              <input type="hidden" name="surgeryTypeId" value={selectedId} />
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
              {septoType && (
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={septoChecked}
                    onChange={(e) =>
                      handleSurgeryTypeChange(
                        idForBuiltInCombo(e.target.checked, essChecked),
                        e,
                        e.target.checked ? SEPTO_BASE_SET : undefined,
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Septo
                </label>
              )}
              {/* 날짜는 수술 전/후 어느 화면에서 저장해도 항상 전송되도록 늘 그려지는
                  이 줄에 둔다 — 예전엔 수술 후 화면에만 있어서, 수술 전 화면에서 저장하면
                  날짜가 빠져 저장이 실패하거나 날짜가 지워졌다. */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <label className="flex items-center gap-1.5">
                  수술 날짜
                  <input
                    type="date"
                    name="plannedDate"
                    value={surgeryDate}
                    onChange={handleSurgeryDateChange}
                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => changeSurgeryDate(localTodayStr())}
                  className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                >
                  오늘
                </button>
              </div>
            </div>
          </div>
          {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
        </div>
        {selected && (
          <div className="flex gap-2 border-b border-slate-200 pb-3">
            <button type="button" onClick={() => changeView("pre")} className={viewButtonClass(view === "pre")}>
              수술 전 (비강 소견 · Op Plan)
            </button>
            <button type="button" onClick={() => changeView("post")} className={viewButtonClass(view === "post")}>
              수술 후 (수술 방법 · 기록지)
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {fixedPatient && <input type="hidden" name="existingPatientId" value={fixedPatient.id} />}

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

        {/* CC는 수술 전 화면에서만 입력한다(사용자 2026-10-16). 수술 후 화면에서 저장해도 지워지지 않게 숨은 값으로 보낸다. */}
        {selected && view === "pre" ? (
          <CcInput
            value={chiefComplaint}
            onChange={(next) => {
              setDirty(true);
              setChiefComplaint(next);
            }}
          />
        ) : (
          <input type="hidden" name="chiefComplaint" value={chiefComplaint} />
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
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => copyPeSide("right")} className={buttonStyles.pill}>
                      우측 → 좌측 복사
                    </button>
                    <button type="button" onClick={() => copyPeSide("left")} className={buttonStyles.pill}>
                      좌측 → 우측 복사
                    </button>
                  </div>
                  <UncinateAttachmentFields
                    fields={nasalFields.filter((f) => UNCINATE_FIELD_KEYS.includes(f.key))}
                    values={templateValues}
                    onChange={regenerateFromForm}
                  />
                  {view === "pre" && (
                    <NasalFindingsOverview
                      showAnatomic={showAnatomicFindings}
                      showSinusitis={showSinusitisFindings}
                      showPolyp={showPolypFindings}
                      onToggleAnatomic={(v) => setFindingGroupOpen(ANATOMIC_RISK_PRESENT_KEYS, v, setShowAnatomicFindings)}
                      onToggleSinusitis={(v) => setFindingGroupOpen(SINUSITIS_PRESENT_KEYS, v, setShowSinusitisFindings)}
                      onTogglePolyp={(v) => setFindingGroupOpen(POLYP_FIELD_KEYS, v, setShowPolypFindings)}
                    />
                  )}
                  {view === "pre" && showSinusitisFindings && (
                    <SinusitisFindingsPicker
                      values={templateValues}
                      onToggle={(key) => toggleFindingWithCascade(key, SINUSITIS_TO_FESS_FIELD)}
                    />
                  )}
                  {view === "pre" && showPolypFindings && (
                    <PolypPicker
                      values={templateValues}
                      onToggle={(key) => toggleFindingWithCascade(key, POLYP_TO_FESS_FIELD)}
                    />
                  )}
                  {view === "pre" && showAnatomicFindings && (
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
                  ...DSN_FIELD_KEYS,
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
              {view === "post" && showSinus && (
                <SinusDiagram values={templateValues} onChange={regenerateFromForm} hideRevisionToggle />
              )}
              {view === "post" && selected.code !== "SEPTOPLASTY" && (
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
              {view === "post" && selected.code === "SEPTOPLASTY" && (
                <TurbinoplastyTypePicker values={templateValues} onChange={regenerateFromForm} hideCopyButtons />
              )}
            </div>
          </div>
        )}

      </div>

      <div ref={previewRef} className="scroll-mt-4 space-y-4">
        {/* 계획 메모는 수술 전·후 어느 화면에서든 맨 위에서 보이게(사용자 2026-10-16) */}
        {selected && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">계획 메모</label>
              <TemplatePicker
                templates={templates}
                onPick={(body) => {
                  const el = planNoteRef.current;
                  if (!el) return;
                  setDirty(true);
                  el.value = appendTemplate(el.value, body);
                }}
              />
            </div>
            <textarea
              ref={planNoteRef}
              name="planNote"
              rows={3}
              defaultValue={editPlan?.planNote ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        )}

        {view === "pre" && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Op Plan 요약</h2>
              {planTable && <CopyButton text={planTableToText(planTable)} />}
            </div>
            {/* 수술 중에 보는 계획표에도 CC를 같이(사용자 2026-10-16) */}
            {chiefComplaint.trim() && (
              <p className="mb-2 text-sm">
                <span className="font-semibold">CC: </span>
                {chiefComplaint}
              </p>
            )}
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
        {/* 특이사항 입력란은 수술 후 화면에서만 보이지만, 수술 전 화면에서 저장해도
            값이 지워지지 않게 실제 전송은 항상 그려지는 숨은 입력으로 한다.
            Remark 칸은 기록지 아래에 있다. */}
        <input type="hidden" name="postOpRemark" value={postOpRemark} />
        {view === "post" && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              {/* 기록지는 여기 하나로 합쳤다(사용자 2026-10-16) — 예전 "정식 기록지"는 따로 만들지 않는다.
                  복사해서 EMR에 붙인다. */}
              <h2 className="text-sm font-semibold text-slate-700">수술기록지</h2>
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
        {/* Remark는 기록지 초안 아래(사용자 2026-10-16) */}
        {view === "post" && selected && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">차트 Remark</h2>
              <CopyButton text={remarkText} disabled={!remarkText} />
            </div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-500">수술 후 특이사항</label>
              <TemplatePicker
                templates={templates}
                onPick={(body) => {
                  setDirty(true);
                  setPostOpRemark((prev) => appendTemplate(prev, body));
                }}
              />
            </div>
            <textarea
              rows={3}
              value={postOpRemark}
              onChange={(e) => {
                // 폼 전체 onChange(기록지 초안 재계산)로 퍼지지 않게 막는다.
                e.stopPropagation();
                setDirty(true);
                setPostOpRemark(e.target.value);
              }}
              placeholder="예: 출혈 많아 Merocel 양측 packing, 특이 합병증 없음"
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {remarkText ? (
              <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-sans text-sm text-slate-800">
                {remarkText}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">CC와 특이사항을 적으면 여기에 remark가 만들어집니다.</p>
            )}
            {silasticReminder && remarkExtras(templateValues).length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {silasticState.done ? (
                  <span className="text-emerald-700">✓ Silastic 제거 리마인더 있음 (환자 화면에서 확인)</span>
                ) : (
                  <button
                    type="button"
                    disabled={silasticPending}
                    onClick={() =>
                      startSilastic(async () => {
                        const res = await silasticReminder.add(surgeryDate);
                        setSilasticState(res.ok ? { done: true } : { done: false, message: res.message });
                      })
                    }
                    className={buttonStyles.smallOutlineAccent}
                  >
                    {silasticPending ? "추가 중..." : "Silastic 제거 리마인더 추가 (수술일 +7일)"}
                  </button>
                )}
                {silasticState.message && <span className="text-red-600">{silasticState.message}</span>}
              </div>
            )}
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
        {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

        {!canSave && (
          <button type="button" onClick={regenerateFromForm} className={`w-full ${buttonStyles.accentOutline}`}>
            위 항목으로 미리보기 새로고침
          </button>
        )}
      </div>

      {/* 저장 줄은 폼의 직속 자식이어야 sticky가 폼 전체 높이 동안 화면 아래에 붙어 있는다. */}
      {canSave && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex gap-2 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button
            type="button"
            onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className={`lg:hidden ${buttonStyles.secondary}`}
          >
            {view === "pre" ? "요약 보기" : "Remark·기록지"}
          </button>
          {/* 예전 "저장"과 "저장 후 기록지 초안"은 저장 뒤 열리는 화면만 달라서 하나로 합쳤다(사용자 2026-10-16).
              저장 뒤에는 지금 보던 화면으로 돌아오고, 수술 후 화면에서 저장하면 계획이 완료로 바뀐다. */}
          <button
            type="submit"
            name="saveIntent"
            value={view === "post" ? "record" : "save"}
            disabled={pending}
            className={`flex-1 ${buttonStyles.primary}`}
          >
            {pending
              ? "저장 중..."
              : editPlan
                ? view === "post" && !editPlan.isDone
                  ? "저장 · 수술 완료로 변경"
                  : "저장"
                : fixedPatient
                  ? "계획 저장"
                  : "환자 등록 + 계획 저장"}
          </button>
        </div>
      )}
    </form>
  );
}
