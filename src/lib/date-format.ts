// 과거에 잘못 저장된 날짜(Invalid Date)가 있어도 페이지 전체가 죽지 않도록
// toISOString() 호출 전에 항상 유효성을 확인한다.
export function safeDateStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
}

// 브라우저 기준 오늘 날짜(YYYY-MM-DD) — toISOString()은 UTC라 한국에선 오전 9시
// 전까지 어제 날짜가 나온다.
export function localTodayStr(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
