"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { importSchedule, previewSchedule, type PreviewRow } from "@/app/actions/schedule-import";

const STATUS_LABEL: Record<PreviewRow["status"], string> = {
  new: "",
  exists: "이미 있음",
  unsupported: "지원 안 됨",
  noChart: "등록번호 없음",
};

export function ImportForm() {
  const [state, formAction, previewing] = useActionState(previewSchedule, undefined);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [importing, startImport] = useTransition();
  const rows = state?.rows ?? [];

  // 새 미리보기가 오면 "new" 행만 기본 체크
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setChecked(new Set(rows.flatMap((r, i) => (r.status === "new" ? [i] : []))));
    setResult(null);
  }

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function runImport() {
    startImport(async () => {
      // code/status는 서버 RowSchema(z.object)가 알아서 떼어낸다
      const selected = rows.filter((_, i) => checked.has(i));
      const r = await importSchedule(selected);
      setResult(r.message ?? `${r.created}건 만들었습니다${r.skipped ? ` (${r.skipped}건 건너뜀)` : ""}.`);
    });
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="file" name="file" accept=".xlsx" required className="text-sm" />
        <button
          type="submit"
          disabled={previewing}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {previewing ? "읽는 중…" : "미리보기"}
        </button>
      </form>
      {state?.message && <p className="text-sm text-amber-700">{state.message}</p>}

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="p-2"></th>
                  <th className="p-2">날짜</th>
                  <th className="p-2">Room</th>
                  <th className="p-2">환자</th>
                  <th className="p-2">진단</th>
                  <th className="p-2">수술</th>
                  <th className="p-2">사이트 종류</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b ${r.status === "new" ? "" : "text-slate-400"}`}>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`${r.date} ${r.procedure} 가져오기`}
                        disabled={r.status !== "new"}
                        checked={checked.has(i)}
                        onChange={() => toggle(i)}
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap">{r.date}</td>
                    <td className="p-2 whitespace-nowrap">
                      {r.room} #{r.order}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {r.name} {r.age} {r.sex}
                    </td>
                    <td className="p-2">{r.diagnosis}</td>
                    <td className="p-2">{r.procedure}</td>
                    <td className="p-2">{r.code ?? "-"}</td>
                    <td className="p-2 whitespace-nowrap">{STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={runImport}
            disabled={importing || checked.size === 0}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {importing ? "만드는 중…" : `체크한 ${checked.size}건 수술 케이스 만들기`}
          </button>
        </>
      )}
      {result && (
        <p className="text-sm text-green-700">
          {result}{" "}
          <Link href="/patients" className="underline">
            환자 목록 보기
          </Link>
        </p>
      )}
    </div>
  );
}
