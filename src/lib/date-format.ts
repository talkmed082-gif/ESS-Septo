// 과거에 잘못 저장된 날짜(Invalid Date)가 있어도 페이지 전체가 죽지 않도록
// toISOString() 호출 전에 항상 유효성을 확인한다.
export function safeDateStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
}
