import type { FieldValues } from "./field-types";

// P/E(비강 소견) 한쪽 값을 반대쪽 짝 칸에 그대로 옮기는 패치 — 키 이름의 right/left
// 토큰으로 짝을 찾는다(n_sinusitis_frontal_right ↔ n_sinusitis_frontal_left,
// n_polyp_right_site_mm ↔ n_polyp_left_site_mm). 짝이 없는 칸은 건드리지 않는다.
export function peSideCopyPatch(
  fieldKeys: readonly string[],
  values: FieldValues,
  from: "right" | "left",
): Record<string, boolean | string> {
  const to = from === "right" ? "left" : "right";
  const keys = new Set(fieldKeys);
  const token = new RegExp(`(^|_)${from}(_|$)`);
  const patch: Record<string, boolean | string> = {};
  for (const key of fieldKeys) {
    if (!token.test(key)) continue;
    const partner = key.replace(token, `$1${to}$2`);
    if (!keys.has(partner)) continue;
    const v = values[key];
    if (typeof v === "boolean" || typeof v === "string") patch[partner] = v;
  }
  return patch;
}
