"use client";

import { useActionState, useState } from "react";
import {
  updateNameStyleSettings,
  type SettingsFormState,
} from "@/app/actions/settings";
import { buildProcedureName, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { buttonStyles } from "@/lib/ui";

const SAMPLE_VALUES = {
  f_left_ant_eth: true,
  f_left_post_eth: true,
  f_right_frontal: true,
  f_right_mma: true,
};

const SIDE_OPTIONS: { value: SideNotation; label: string; example: string }[] = [
  { value: "full", label: "Rt. / Lt. / Both", example: "Rt. ESS(...)" },
  { value: "paren", label: "R) / L) / B)", example: "R) ESS(...)" },
  { value: "bracket", label: "R] / L] / B]", example: "R] ESS(...)" },
];

export function SettingsForm({
  initialSideNotation,
  initialAbbreviate,
}: {
  initialSideNotation: SideNotation;
  initialAbbreviate: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    SettingsFormState | undefined,
    FormData
  >(updateNameStyleSettings, undefined);
  const [sideNotation, setSideNotation] = useState<SideNotation>(initialSideNotation);
  const [abbreviate, setAbbreviate] = useState(initialAbbreviate);

  const style: NameStyle = { sideNotation, abbreviateRegions: abbreviate };
  const preview = buildProcedureName("ESS", SAMPLE_VALUES, style);

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">방향 표기 방식</p>
        <div className="space-y-2">
          {SIDE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sideNotation"
                value={opt.value}
                checked={sideNotation === opt.value}
                onChange={() => setSideNotation(opt.value)}
                className="h-4 w-4"
              />
              {opt.label}
              <span className="text-slate-400">({opt.example})</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">수술명 부위 표기</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="abbreviateRegions"
              value="false"
              checked={!abbreviate}
              onChange={() => setAbbreviate(false)}
              className="h-4 w-4"
            />
            전체 이름 (Frontal, Maxillary)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="abbreviateRegions"
              value="true"
              checked={abbreviate}
              onChange={() => setAbbreviate(true)}
              className="h-4 w-4"
            />
            약어 (FM, FEMS, MS ...)
          </label>
        </div>
      </div>

      <div className="rounded-md border border-slate-300 bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-500">미리보기 (예시)</p>
        <p className="font-mono text-sm text-slate-900">{preview}</p>
      </div>

      {state?.message && <p className="text-sm text-emerald-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className={buttonStyles.primary}
      >
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
