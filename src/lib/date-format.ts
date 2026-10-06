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

// 서버(Vercel)는 UTC로 돌아서 그냥 new Date()로 날짜·시간을 만들면 한국 시간보다
// 9시간 늦다 — 오전 9시 전엔 날짜가 어제로 나온다. 서버에서 "지금"이 필요한 곳은
// 한국 시간 기준으로 읽는다.
export function seoulNow(now: Date = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// 날짜는 "YYYY-MM-DD"를 UTC 자정으로 저장하므로, 한국 기준 오늘을 같은 방식으로
// 만들어야 "오늘 이후 수술" 같은 비교가 맞는다.
export function seoulTodayAsStoredDate(now: Date = new Date()): Date {
  return new Date(seoulNow(now).date);
}
