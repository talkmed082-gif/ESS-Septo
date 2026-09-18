"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { SurgeryFieldInputs } from "@/components/surgery-field-inputs";
import {
  SeptumDiagram,
  SinusDiagram,
  getAnatomyVisibility,
  getSeptumCoveredKeys,
  getSinusCoveredKeys,
} from "@/components/anatomy-diagram";
import { PolypPicker, POLYP_FIELD_KEYS } from "@/components/polyp-picker";
import { fieldValuesFromFormData, type FieldValues, type SurgeryFieldDef } from "@/lib/field-types";
import { isBuiltInSurgeryCode, isNasalFindingKey } from "@/lib/op-note-defs";
import { buildProcedureName, generateOpNote, generatePlanSummary, type NameStyle } from "@/lib/op-note-generator";

export interface SurgeryTypeOption {
  id: string;
  code: string;
  name: string;
  fields: SurgeryFieldDef[];
}

function buildTexts(
  code: string,
  fields: SurgeryFieldDef[],
  values: FieldValues,
  anesthesiaType: string,
  nameStyle?: NameStyle,
): { planText: string; recordText: string } {
  if (!isBuiltInSurgeryCode(code)) {
    return {
      planText: "이 수술 종류는 자동 작성을 지원하지 않습니다.",
      recordText: "이 수술 종류는 자동 작성을 지원하지 않습니다.",
    };
  }
  const plan = generatePlanSummary(code, values, nameStyle);
  const record = generateOpNote(code, values, "record", anesthesiaType);
  const procedureName = buildProcedureName(code, values, nameStyle);
  return {
    planText: plan,
    recordText: `수술명: ${procedureName}\n\n[수술 소견]\n${record.findings}\n\n[수술 과정]\n${record.procedureDetail}`,
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

export function QuickTool({
  surgeryTypes,
  loggedIn,
  nameStyle,
}: {
  surgeryTypes: SurgeryTypeOption[];
  loggedIn: boolean;
  nameStyle?: NameStyle;
}) {
  const first = surgeryTypes[0];
  const [selectedId, setSelectedId] = useState(first?.id ?? "");
  const [anesthesiaType, setAnesthesiaType] = useState("General");
  const [{ planText, recordText }, setTexts] = useState(() =>
    first ? buildTexts(first.code, first.fields, {}, "General", nameStyle) : { planText: "", recordText: "" },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const selected = surgeryTypes.find((st) => st.id === selectedId);
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
    setTexts(buildTexts(selected.code, selected.fields, values, anesthesiaType, nameStyle));
  }

  function handleSurgeryTypeChange(id: string) {
    setSelectedId(id);
    const next = surgeryTypes.find((st) => st.id === id);
    if (next) setTexts(buildTexts(next.code, next.fields, {}, anesthesiaType, nameStyle));
  }

  function handleAnesthesiaChange(value: string) {
    setAnesthesiaType(value);
    if (selected && formRef.current) {
      const values = fieldValuesFromFormData(new FormData(formRef.current), selected.fields);
      setTexts(buildTexts(selected.code, selected.fields, values, value, nameStyle));
    }
  }

  if (!first) {
    return <p className="text-sm text-slate-500">등록된 수술 종류가 없습니다.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form ref={formRef} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">수술 종류</label>
          <select
            value={selectedId}
            onChange={(e) => handleSurgeryTypeChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {surgeryTypes.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            마취 방법 (기록지용)
          </label>
          <select
            value={anesthesiaType}
            onChange={(e) => handleAnesthesiaChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="General">전신마취 (General)</option>
            <option value="Local">국소마취 (Local)</option>
            <option value="MAC">MAC</option>
          </select>
        </div>

        {selected && (
          <div key={selected.id} className="space-y-4">
            <div className="flex gap-2 border-b border-slate-200 pb-3">
              <button type="button" onClick={() => setStep(1)} className={stepButtonClass(step === 1)}>
                1. 비강/영상 소견
              </button>
              <button type="button" onClick={() => setStep(2)} className={stepButtonClass(step === 2)}>
                2. 수술 방법
              </button>
            </div>
            <div className={step === 1 ? "space-y-4" : "hidden"}>
              {showSeptum && <SeptumDiagram />}
              <PolypPicker />
              <SurgeryFieldInputs
                fields={nasalFields}
                excludeKeys={[...getSeptumCoveredKeys(selected.code), ...POLYP_FIELD_KEYS]}
              />
            </div>
            <div className={step === 2 ? "space-y-4" : "hidden"}>
              {showSinus && <SinusDiagram />}
              <SurgeryFieldInputs
                fields={procedureFields}
                excludeKeys={getSinusCoveredKeys(selected.code)}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={regenerateFromForm}
          className="w-full rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          위 항목으로 미리보기 생성 / 새로고침
        </button>
      </form>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Op Plan 요약</h2>
            <CopyButton text={planText} />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{planText}</pre>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">수술기록지 초안</h2>
            <CopyButton text={recordText} />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{recordText}</pre>
        </div>
        <p className="text-xs text-slate-500">
          자동 생성된 초안입니다. 항목을 바꾼 뒤에는 왼쪽의 &quot;미리보기 생성 / 새로고침&quot;을 눌러야 반영됩니다.
          실제 소견에 맞게 검토 후 사용해주세요.
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
