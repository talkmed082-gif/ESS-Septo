"use client";

import { useMemo, useState } from "react";
import { AUDIENCES, FIRST_FIELDS, FOLLOW_FIELDS, TEMPLATE_KINDS, type SetOrderRef } from "@/lib/outpatient-templates";
import { buttonStyles } from "@/lib/ui";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export type SetOrderOption = SetOrderRef & { path: string; ownerName: string };
type Template = { title: string; kind: string; sortOrder: number; audience?: string; shortcut?: number | null; setOrders: SetOrderRef[] } & Record<string, unknown>;

const sameRef = (a: SetOrderRef, b: SetOrderRef) => a.ownerEmpNo === b.ownerEmpNo && a.key === b.key;

// 외래 템플릿 한 개(또는 새 템플릿) 편집 — 초진·재진 칸과 연결할 약속처방
export function TemplateForm({
  template,
  audience,
  options,
  myEmpNo,
  action,
  deleteAction,
}: {
  template: Template | null;
  audience?: string;
  options: SetOrderOption[];
  myEmpNo: string | null;
  action: (formData: FormData) => Promise<void>;
  deleteAction?: (formData: FormData) => Promise<void>;
}) {
  const [refs, setRefs] = useState<SetOrderRef[]>(template?.setOrders ?? []);
  const [q, setQ] = useState("");
  const found = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return options
      .filter((o) => !refs.some((r) => sameRef(r, o)))
      .filter((o) => words.every((w) => `${o.path} ${o.name} ${o.ownerName}`.toLowerCase().includes(w)))
      .slice(0, 40);
  }, [q, options, refs]);
  const label = (r: SetOrderRef) => {
    const o = options.find((x) => sameRef(x, r));
    const who = r.ownerEmpNo !== myEmpNo ? ` (${o?.ownerName || r.ownerEmpNo})` : "";
    return `${o ? o.name : `${r.name} — 목록에 없음`}${who}`;
  };
  const text = (k: string) => String(template?.[k] ?? "");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="setOrders" value={JSON.stringify(refs)} />
      <div className="flex flex-wrap gap-2">
        <input name="title" required maxLength={60} defaultValue={template?.title ?? ""} placeholder="이름(예: 코막힘)" aria-label="템플릿 이름" className={`${inputClass} flex-1`} />
        <select name="kind" defaultValue={template?.kind ?? "symptom"} aria-label="종류" className="rounded-md border border-slate-300 px-2 text-sm">
          {Object.entries(TEMPLATE_KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="audience" defaultValue={template?.audience ?? audience ?? "adult"} aria-label="대상" className="rounded-md border border-slate-300 px-2 text-sm">
          {Object.entries(AUDIENCES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input name="shortcut" type="number" min={1} max={9} defaultValue={template?.shortcut ?? ""} aria-label="단축 번호" title="단축 번호 1~9 — 프로그램에서 Ctrl+Shift+번호" placeholder="번호" className="w-16 rounded-md border border-slate-300 px-2 text-sm" />
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={template?.sortOrder ?? 0} aria-label="순서" title="순서(작을수록 위)" className="w-20 rounded-md border border-slate-300 px-2 text-sm" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">초진 기록지</legend>
          {FIRST_FIELDS.map(([k, name]) => (
            <label key={k} className="block text-xs text-slate-500">
              {name}
              <textarea name={k} rows={k === "firstPi" ? 6 : 3} maxLength={4000} defaultValue={text(k)} className={inputClass} />
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500">재진(경과) 기록지</legend>
          {FOLLOW_FIELDS.map(([k, name]) => (
            <label key={k} className="block text-xs text-slate-500">
              {name}
              <textarea name={k} rows={3} maxLength={4000} defaultValue={text(k)} className={inputClass} />
            </label>
          ))}

          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold text-slate-500">약속처방</p>
            {refs.length === 0 && <p className="text-xs text-slate-400">연결한 약속처방 없음</p>}
            <ul className="space-y-1">
              {refs.map((r) => (
                <li key={`${r.ownerEmpNo}^${r.key}`} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1 text-sm">
                  <span>{label(r)}</span>
                  <button type="button" onClick={() => setRefs(refs.filter((x) => !sameRef(x, r)))} className={buttonStyles.smallOutline}>
                    빼기
                  </button>
                </li>
              ))}
            </ul>
            {options.length === 0 ? (
              <p className="text-xs text-slate-400">진료실 PC 프로그램이 EMR 약속처방 목록을 올리면 여기서 고를 수 있습니다.</p>
            ) : (
              <>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="약속처방 검색(여러 단어 가능)" aria-label="약속처방 검색" className={inputClass} />
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                  {found.map((o) => (
                    <li key={`${o.ownerEmpNo}^${o.key}`}>
                      <button
                        type="button"
                        onClick={() => setRefs([...refs, { ownerEmpNo: o.ownerEmpNo, key: o.key, name: o.name }])}
                        className="w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100"
                      >
                        <span className="text-slate-400">{o.path ? `${o.path} › ` : ""}</span>
                        {o.name}
                        {o.ownerEmpNo !== myEmpNo && <span className="text-slate-400"> ({o.ownerName || o.ownerEmpNo})</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </fieldset>
      </div>

      <div className="flex gap-2">
        <button type="submit" className={buttonStyles.primarySmall}>
          {template ? "저장" : "템플릿 추가"}
        </button>
        {deleteAction && (
          <button type="submit" formAction={deleteAction} className={buttonStyles.danger}>
            삭제
          </button>
        )}
      </div>
    </form>
  );
}
