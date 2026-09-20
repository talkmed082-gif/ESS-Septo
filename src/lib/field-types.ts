export type SurgeryFieldType =
  | "checkbox"
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "number";

export interface SurgeryFieldDef {
  key: string;
  label: string;
  type: SurgeryFieldType;
  options?: string[];
  default?: string;
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
      default: typeof f.default === "string" ? f.default : undefined,
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
    } else if (field.type === "multiselect") {
      values[field.key] = formData
        .getAll(name)
        .filter((v): v is string => typeof v === "string")
        .join(", ");
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

// 필드에 default가 있는데 values에 아직 값이 없으면(신규 계획 등) default를
// 채워 넣는다. 화면의 hidden input은 defaultChecked/defaultValue로 이미
// default를 반영해서 보여주는데, 최초 렌더링 시 미리보기 텍스트는 이 값을
// 안 거치고 원본 values(빈 객체)로 만들어져서 "값을 아무거나 한 번 바꾸기
// 전까지는 미리보기에 default가 안 보이는" 불일치가 있었다 — 이 함수로
// 미리보기 계산 전에 값을 맞춰준다.
export function applyFieldDefaults(values: FieldValues, fields: SurgeryFieldDef[]): FieldValues {
  const result: FieldValues = { ...values };
  for (const field of fields) {
    if (result[field.key] !== undefined || !field.default) continue;
    result[field.key] = field.type === "checkbox" ? field.default === "true" : field.default;
  }
  return result;
}
