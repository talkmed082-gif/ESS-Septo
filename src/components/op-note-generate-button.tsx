"use client";

import { useState } from "react";
import { fieldValuesFromFormData, type SurgeryFieldDef } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import {
  buildProcedureName,
  generateOpNote,
  generatePlanSummary,
  type OpNoteMode,
} from "@/lib/op-note-generator";

function setFieldValue(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.value = value;
  }
}

export function OpNoteGenerateButton({
  fields,
  surgeryTypeCode,
  mode,
}: {
  fields: SurgeryFieldDef[];
  surgeryTypeCode: string;
  mode: OpNoteMode;
}) {
  const [justGenerated, setJustGenerated] = useState(false);

  if (!isBuiltInSurgeryCode(surgeryTypeCode)) return null;
  const code = surgeryTypeCode;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    if (!form) return;

    const formData = new FormData(form);
    const values = fieldValuesFromFormData(formData, fields);

    if (mode === "plan") {
      setFieldValue(form, "planNote", generatePlanSummary(code, values));
    } else {
      const anesthesiaType = formData.get("anesthesiaType");
      const result = generateOpNote(
        code,
        values,
        mode,
        typeof anesthesiaType === "string" ? anesthesiaType : undefined,
      );
      setFieldValue(form, "procedureName", buildProcedureName(code, values));
      setFieldValue(form, "findings", result.findings);
      setFieldValue(form, "procedureDetail", result.procedureDetail);
    }

    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
    >
      {justGenerated
        ? "생성됨 ✓ (검토 후 저장하세요)"
        : mode === "plan"
          ? "위 항목으로 계획 요약 자동 작성"
          : "위 항목으로 문장 자동 작성"}
    </button>
  );
}
