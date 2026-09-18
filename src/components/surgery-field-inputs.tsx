import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";

export function SurgeryFieldInputs({
  fields,
  values,
}: {
  fields: SurgeryFieldDef[];
  values?: FieldValues;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      {fields.map((field) => {
        const name = `field_${field.key}`;
        const value = values?.[field.key];

        if (field.type === "checkbox") {
          return (
            <label key={field.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={name}
                defaultChecked={value === true}
                className="h-4 w-4 rounded border-slate-300"
              />
              {field.label}
            </label>
          );
        }

        if (field.type === "select") {
          return (
            <div key={field.key}>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {field.label}
              </label>
              <select
                name={name}
                defaultValue={typeof value === "string" ? value : field.default ?? ""}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
                <option value="">선택 안 함</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (field.type === "textarea") {
          return (
            <div key={field.key}>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {field.label}
              </label>
              <textarea
                name={name}
                defaultValue={typeof value === "string" ? value : field.default ?? ""}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
          );
        }

        return (
          <div key={field.key}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {field.label}
            </label>
            <input
              type={field.type === "number" ? "number" : "text"}
              name={name}
              defaultValue={typeof value === "string" ? value : field.default ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        );
      })}
    </div>
  );
}
