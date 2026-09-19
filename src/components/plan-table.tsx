"use client";

import type { PlanTable } from "@/lib/op-note-generator";

export function PlanTableView({
  table,
  size = "normal",
  interactive = false,
  onToggle,
}: {
  table: PlanTable;
  size?: "normal" | "large";
  // true면 FESS 시행 부위 표의 체크마크를 직접 클릭해서 바로 켜고 끌 수 있다
  // (모식도까지 왔다갔다 하지 않고 표에서 바로 빠르게 체크하기 위함).
  interactive?: boolean;
  // 클릭된 필드 키(예: "f_right_frontal")를 그대로 넘겨준다 — 실제 값 반영은
  // 상위(SurgeryPlanner)가 담당해 모식도 등 다른 입력 방식과 상태를 맞춘다.
  onToggle?: (fieldKey: string) => void;
}) {
  const textSize = size === "large" ? "text-lg" : "text-sm";
  const cellPad = size === "large" ? "px-3 py-2.5" : "px-2 py-1.5";

  const nameSize = size === "large" ? "text-2xl" : "text-base";

  function toggleCell(prefix: "f_left_" | "f_right_", key: string) {
    if (!interactive) return;
    onToggle?.(`${prefix}${key}`);
  }

  return (
    <div className="space-y-4">
      <p className={`${nameSize} font-bold`}>{table.procedureName}</p>

      {table.findings && (
        <div className={`${textSize} whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 p-3`}>
          <span className="font-semibold">비강/영상 소견 (요약): </span>
          {table.findings}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={`w-full border-collapse ${textSize}`}>
          <tbody>
            {table.keyValueRows.map((row) => (
              <tr key={row.label}>
                <th
                  className={`w-24 border border-slate-400 bg-slate-50 sm:w-32 ${cellPad} text-left align-top font-medium`}
                >
                  {row.label}
                </th>
                <td className={`border border-slate-400 ${cellPad} align-top`}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.sideMatrix && (
        <div className="overflow-x-auto">
        <table className={`w-full border-collapse ${textSize}`}>
          <thead>
            <tr>
              <th className={`border border-slate-400 bg-slate-50 ${cellPad} text-left font-medium`}>
                {table.sideMatrix.title}
                {interactive && (
                  <span className="ml-2 font-normal text-slate-400">(클릭해서 체크)</span>
                )}
              </th>
              <th className={`w-20 border border-slate-400 bg-slate-50 ${cellPad} font-medium`}>
                우측
              </th>
              <th className={`w-20 border border-slate-400 bg-slate-50 ${cellPad} font-medium`}>
                좌측
              </th>
            </tr>
          </thead>
          <tbody>
            {table.sideMatrix.rows.map((row) => (
              <tr key={row.label}>
                <td className={`border border-slate-400 ${cellPad}`}>{row.label}</td>
                <td className={`border border-slate-400 ${cellPad} text-center`}>
                  {interactive ? (
                    <button
                      type="button"
                      onClick={() => toggleCell("f_right_", row.key)}
                      className={`h-6 w-6 rounded touch-manipulation active:scale-95 ${
                        row.right ? "bg-emerald-600 text-white" : "bg-slate-100 text-transparent hover:bg-slate-200"
                      }`}
                    >
                      ✓
                    </button>
                  ) : (
                    row.right ? "✓" : ""
                  )}
                </td>
                <td className={`border border-slate-400 ${cellPad} text-center`}>
                  {interactive ? (
                    <button
                      type="button"
                      onClick={() => toggleCell("f_left_", row.key)}
                      className={`h-6 w-6 rounded touch-manipulation active:scale-95 ${
                        row.left ? "bg-emerald-600 text-white" : "bg-slate-100 text-transparent hover:bg-slate-200"
                      }`}
                    >
                      ✓
                    </button>
                  ) : (
                    row.left ? "✓" : ""
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
