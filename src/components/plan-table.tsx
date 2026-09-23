"use client";

import type { PlanSideMatrixRow, PlanTable } from "@/lib/op-note-generator";
import { CHECK_MARK, DataCell } from "@/components/check-cell";
import { buttonStyles } from "@/lib/ui";

export function SideMatrixTable({
  title,
  rows,
  textSize = "text-sm",
  cellPad = "px-2 py-1.5",
  interactive,
  onToggle,
  onCopySide,
}: {
  title: string;
  rows: PlanSideMatrixRow[];
  textSize?: string;
  cellPad?: string;
  interactive: boolean;
  onToggle?: (fieldKey: string) => void;
  onCopySide?: (from: "f_left_" | "f_right_") => void;
}) {
  return (
    <div className="overflow-x-auto">
      {interactive && onCopySide && (
        <div className="mb-2 flex gap-2">
          <button type="button" onClick={() => onCopySide("f_right_")} className={buttonStyles.pill}>
            우→좌 동일
          </button>
          <button type="button" onClick={() => onCopySide("f_left_")} className={buttonStyles.pill}>
            좌→우 동일
          </button>
        </div>
      )}
      <table className={`w-full border-collapse ${textSize}`}>
        <thead>
          <tr>
            <th className={`border border-slate-400 bg-slate-50 ${cellPad} text-left font-medium`}>
              {title}
              {interactive && <span className="ml-2 font-normal text-slate-400">(클릭해서 체크)</span>}
            </th>
            <th className={`w-20 border border-slate-400 bg-slate-50 ${cellPad} font-medium`}>우측</th>
            <th className={`w-20 border border-slate-400 bg-slate-50 ${cellPad} font-medium`}>좌측</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className={`border border-slate-400 ${cellPad}`}>{row.label}</td>
              {interactive ? (
                <>
                  <td className={`border border-slate-400 ${cellPad} text-center`}>
                    <button
                      type="button"
                      onClick={() => onToggle?.(row.rightFieldKey)}
                      className={`h-6 w-6 rounded touch-manipulation active:scale-95 ${
                        row.right ? "bg-emerald-600 text-white" : "bg-slate-100 text-transparent hover:bg-slate-200"
                      }`}
                    >
                      {CHECK_MARK}
                    </button>
                  </td>
                  <td className={`border border-slate-400 ${cellPad} text-center`}>
                    <button
                      type="button"
                      onClick={() => onToggle?.(row.leftFieldKey)}
                      className={`h-6 w-6 rounded touch-manipulation active:scale-95 ${
                        row.left ? "bg-emerald-600 text-white" : "bg-slate-100 text-transparent hover:bg-slate-200"
                      }`}
                    >
                      {CHECK_MARK}
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <DataCell checked={row.right} className={cellPad} />
                  <DataCell checked={row.left} className={cellPad} />
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlanTableView({
  table,
  size = "normal",
  interactive = false,
  onToggle,
  onCopySide,
}: {
  table: PlanTable;
  size?: "normal" | "large";
  // true면 FESS 시행 부위 표의 체크마크를 직접 클릭해서 바로 켜고 끌 수 있다
  // (모식도까지 왔다갔다 하지 않고 표에서 바로 빠르게 체크하기 위함).
  interactive?: boolean;
  // 클릭된 필드 키(예: "f_right_frontal")를 그대로 넘겨준다 — 실제 값 반영은
  // 상위(SurgeryPlanner)가 담당해 모식도 등 다른 입력 방식과 상태를 맞춘다.
  onToggle?: (fieldKey: string) => void;
  // 우측/좌측 중 어느 쪽 값을 반대쪽에 그대로 복사할지 상위에 알려준다.
  onCopySide?: (from: "f_left_" | "f_right_") => void;
}) {
  const textSize = size === "large" ? "text-lg" : "text-sm";
  const cellPad = size === "large" ? "px-3 py-2.5" : "px-2 py-1.5";

  const nameSize = size === "large" ? "text-2xl" : "text-base";

  return (
    <div className="space-y-4">
      <p className={`${nameSize} font-bold`}>{table.procedureName}</p>

      {table.findings && (
        <div className={`${textSize} whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 p-3`}>
          <span className="font-semibold">비강 소견 (요약): </span>
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
                <td className={`border border-slate-400 ${cellPad} align-top`}>
                  {interactive && row.toggleKey ? (
                    <button
                      type="button"
                      onClick={() => onToggle?.(row.toggleKey!)}
                      className={`touch-manipulation rounded px-2 py-0.5 font-medium active:scale-95 ${
                        row.value === "사용"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {row.value}
                    </button>
                  ) : (
                    row.value
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.sideMatrix && (
        <SideMatrixTable
          title={table.sideMatrix.title}
          rows={table.sideMatrix.rows}
          textSize={textSize}
          cellPad={cellPad}
          interactive={interactive}
          onToggle={onToggle}
          onCopySide={onCopySide}
        />
      )}

      {table.turbMatrix && (
        <SideMatrixTable
          title={table.turbMatrix.title}
          rows={table.turbMatrix.rows}
          textSize={textSize}
          cellPad={cellPad}
          interactive={interactive}
          onToggle={onToggle}
        />
      )}
    </div>
  );
}
