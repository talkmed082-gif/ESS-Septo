import type { PlanTable } from "@/lib/op-note-generator";

export function PlanTableView({
  table,
  size = "normal",
}: {
  table: PlanTable;
  size?: "normal" | "large";
}) {
  const textSize = size === "large" ? "text-lg" : "text-sm";
  const cellPad = size === "large" ? "px-3 py-2.5" : "px-2 py-1.5";

  const nameSize = size === "large" ? "text-2xl" : "text-base";

  return (
    <div className="space-y-4">
      <p className={`${nameSize} font-bold`}>{table.procedureName}</p>

      {table.findings && (
        <div className={`${textSize} whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 p-3`}>
          <span className="font-semibold">비강/영상 소견 (요약): </span>
          {table.findings}
        </div>
      )}

      <table className={`w-full border-collapse ${textSize}`}>
        <tbody>
          {table.keyValueRows.map((row) => (
            <tr key={row.label}>
              <th
                className={`w-32 border border-slate-400 bg-slate-50 ${cellPad} text-left align-top font-medium`}
              >
                {row.label}
              </th>
              <td className={`border border-slate-400 ${cellPad} align-top`}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {table.sideMatrix && (
        <table className={`w-full border-collapse ${textSize}`}>
          <thead>
            <tr>
              <th className={`border border-slate-400 bg-slate-50 ${cellPad} text-left font-medium`}>
                {table.sideMatrix.title}
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
                  {row.right ? "✓" : ""}
                </td>
                <td className={`border border-slate-400 ${cellPad} text-center`}>
                  {row.left ? "✓" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
