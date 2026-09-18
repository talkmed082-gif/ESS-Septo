export type SurgeryFieldType =
  | "checkbox"
  | "text"
  | "textarea"
  | "select"
  | "number";

export interface SurgeryFieldDef {
  key: string;
  label: string;
  type: SurgeryFieldType;
  options?: string[];
}

export function parseFieldDefs(json: unknown): SurgeryFieldDef[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (f): f is SurgeryFieldDef =>
        !!f &&
        typeof f === "object" &&
        typeof (f as SurgeryFieldDef).key === "string" &&
        typeof (f as SurgeryFieldDef).label === "string",
    )
    .map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type ?? "text",
      options: Array.isArray(f.options) ? f.options : undefined,
    }));
}

export type FieldValues = Record<string, string | boolean>;

export function fieldValuesFromFormData(
  formData: FormData,
  fields: SurgeryFieldDef[],
): FieldValues {
  const values: FieldValues = {};
  for (const field of fields) {
    const name = `field_${field.key}`;
    if (field.type === "checkbox") {
      values[field.key] = formData.get(name) === "on";
    } else {
      values[field.key] = (formData.get(name) as string | null) ?? "";
    }
  }
  return values;
}

export function parseFieldValues(json: unknown): FieldValues {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return json as FieldValues;
}
