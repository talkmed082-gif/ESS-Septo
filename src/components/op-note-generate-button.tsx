"use client";

import { useState } from "react";
import { fieldValuesFromFormData, type SurgeryFieldDef } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildProcedureName, generateOpNote, type NameStyle } from "@/lib/op-note-generator";

function setFieldValue(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.value = value;
  }
}

export function OpNoteGenerateButton({
  fields,
  surgeryTypeCode,
  nameStyle,
}: {
  fields: SurgeryFieldDef[];
  surgeryTypeCode: string;
  nameStyle?: NameStyle;
}) {
  const [justGenerated, setJustGenerated] = useState(false);

  if (!isBuiltInSurgeryCode(surgeryTypeCode)) return null;
  const code = surgeryTypeCode;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    if (!form) return;

    const formData = new FormData(form);
    const values = fieldValuesFromFormData(formData, fields);
    const anesthesiaType = formData.get("anesthesiaType");
    const result = generateOpNote(
      code,
      values,
      "record",
      typeof anesthesiaType === "string" ? anesthesiaType : undefined,
    );
    setFieldValue(form, "procedureName", buildProcedureName(code, values, nameStyle));
    // 소견/과정을 한 칸에 이어서 보여주므로 두 텍스트를 합쳐서 한 필드에 채운다.
    setFieldValue(
      form,
      "procedureDetail",
      [result.findings, result.procedureDetail].filter(Boolean).join("\n\n"),
    );

    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
    >
      {justGenerated ? "생성됨 ✓ (검토 후 저장하세요)" : "위 항목으로 문장 자동 작성"}
    </button>
  );
}
