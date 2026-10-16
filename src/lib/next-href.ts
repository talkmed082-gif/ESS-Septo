// "저장하고 이동" 때 저장 뒤 갈 주소 — 이 사이트 안의 경로("/..."로 시작)만 받는다(외부 주소로 보내지 않게).
export function safeNextHref(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  return v;
}
