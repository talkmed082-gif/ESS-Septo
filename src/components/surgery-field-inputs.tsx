import { memo } from "react";
import type { FieldValues, SurgeryFieldDef } from "@/lib/field-types";

function multiselectValues(value: string | boolean | undefined, field: SurgeryFieldDef): string[] {
  const raw = typeof value === "string" ? value : (field.default ?? "");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function HiddenFieldInput({
  field,
  value,
}: {
  field: SurgeryFieldDef;
  value: string | boolean | undefined;
}) {
  const name = `field_${field.key}`;
  if (field.type === "checkbox") {
    return (
      <input
        type="checkbox"
        name={name}
        defaultChecked={typeof value === "boolean" ? value : field.default === "true"}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    );
  }
  if (field.type === "multiselect") {
    const selected = multiselectValues(value, field);
    return (
      <>
        {(field.options ?? []).map((opt) => (
          <input
            key={opt}
            type="checkbox"
            name={name}
            value={opt}
            defaultChecked={selected.includes(opt)}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        ))}
      </>
    );
  }
  if (field.type === "select") {
    return (
      <select
        name={name}
        defaultValue={typeof value === "string" ? value : field.default ?? ""}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      >
        <option value="" />
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </select>
    );
  }
  return (
    <input
      type="hidden"
      name={name}
      defaultValue={typeof value === "string" ? value : field.default ?? ""}
    />
  );
}

function SurgeryFieldInputsImpl({
  fields,
  values,
  excludeKeys,
}: {
  fields: SurgeryFieldDef[];
  values?: FieldValues;
  excludeKeys?: string[];
}) {
  const visibleFields = excludeKeys
    ? fields.filter((f) => !excludeKeys.includes(f.key))
    : fields;
  const hiddenFields = excludeKeys
    ? fields.filter((f) => excludeKeys.includes(f.key))
    : [];

  return (
    <>
      {hiddenFields.map((field) => (
        <HiddenFieldInput key={field.key} field={field} value={values?.[field.key]} />
      ))}

      {visibleFields.length > 0 && (
        <div className="space-y-3 rounded-md border border-slate-200 p-4">
          {visibleFields.map((field) => {
            const name = `field_${field.key}`;
            const value = values?.[field.key];

            if (field.type === "checkbox") {
              return (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={typeof value === "boolean" ? value : field.default === "true"}
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

            if (field.type === "multiselect") {
              const selected = multiselectValues(value, field);
              return (
                <div key={field.key}>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {field.label}
                  </label>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-slate-300 px-3 py-2">
                    {(field.options ?? []).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          name={name}
                          value={opt}
                          defaultChecked={selected.includes(opt)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
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
      )}
    </>
  );
}

function sameKeys(a: { key: string }[] | undefined, b: { key: string }[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((f, i) => f.key === b[i].key);
}

function sameStrings(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// 이 입력들은 값을 defaultChecked/defaultValue로만 쓰는 비제어 입력이라, 마운트
// 이후에 values가 바뀌어도 화면이 달라지지 않는다(값이 바뀌면 부모가 key를 바꿔
// 새로 마운트한다). 그래서 values 변화로는 다시 그리지 않고, 필드 구성이 실제로
// 달라졌을 때만 다시 그린다 — 셀을 누를 때마다 수십 개 입력을 헛되이 다시 그리던
// 비용을 없앤다.
export const SurgeryFieldInputs = memo(SurgeryFieldInputsImpl, (prev, next) =>
  sameKeys(prev.fields, next.fields) && sameStrings(prev.excludeKeys, next.excludeKeys),
);
