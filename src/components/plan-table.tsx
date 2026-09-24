"use client";

import { useState } from "react";
import type { PlanSideMatrixRow, PlanTable } from "@/lib/op-note-generator";
import { DataCell } from "@/components/check-cell";
import { MatrixCellButton } from "@/components/matrix-cell-button";
import { TapButton } from "@/components/tap-button";
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
    <div className="overflow-x-auto overflow-y-hidden">
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
            <th className={`border border-slate-400 bg-slate-50 ${cellPad} text-left font-medium`}>{title}</th>
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
                    <MatrixCellButton checked={row.right} onToggle={() => onToggle?.(row.rightFieldKey)} />
                  </td>
                  <td className={`border border-slate-400 ${cellPad} text-center`}>
                    <MatrixCellButton checked={row.left} onToggle={() => onToggle?.(row.leftFieldKey)} />
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

  // Turbinoplasty는 안 하는 경우가 더 많아 기본으로는 접어두고, 체크해야
  // 표가 열리게 한다 — 이미 값이 있으면(수정 화면 등) 처음부터 펼쳐둔다.
  const [turbExpanded, setTurbExpanded] = useState(
    () => table.turbMatrix?.rows.some((r) => r.left || r.right) ?? false,
  );

  return (
    <div className="space-y-4">
      <p className={`${nameSize} font-bold`}>{table.procedureName}</p>

      {table.findings && (
        <div className={`${textSize} whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 p-3`}>
          <span className="font-semibold">비강 소견 (요약): </span>
          {table.findings}
        </div>
      )}

      <div className="overflow-x-auto overflow-y-hidden">
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
                    <TapButton
                      onTap={() => onToggle?.(row.toggleKey!)}
                      className={`rounded px-2 py-0.5 font-medium ${
                        row.value === "사용"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {row.value}
                    </TapButton>
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

      {table.turbMatrix && (interactive || turbExpanded) && (
        <div>
          {interactive && (
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={turbExpanded}
                onChange={(e) => setTurbExpanded(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Turbinoplasty
            </label>
          )}
          {(turbExpanded || !interactive) && (
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
      )}
    </div>
  );
}
