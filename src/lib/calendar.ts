function toIcsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export function buildIcsContent({
  uid,
  title,
  date,
  description,
}: {
  uid: string;
  title: string;
  date: Date;
  description?: string;
}): string {
  const dtStart = toIcsDate(date);
  const dtEnd = toIcsDate(addDays(date, 1));
  const dtStamp = toIcsDate(new Date()) + "T000000Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ESS-Septo//Op Plan//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
  ];
  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
}

export function buildGoogleCalendarUrl({
  title,
  date,
  details,
}: {
  title: string;
  date: Date;
  details?: string;
}): string {
  const start = toIcsDate(date);
  const end = toIcsDate(addDays(date, 1));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
  });
  if (details) params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export interface CalendarFeedEvent {
  uid: string;
  title: string;
  date: Date;
  // 일정이 바뀐 시각 — 구독하는 캘린더가 수정 여부를 판단하는 기준(DTSTAMP)
  updatedAt: Date;
  description?: string;
}

function toIcsDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

// 구글 캘린더 "URL로 추가"에서 구독하는 다건 피드 — 매번 전체 스냅샷을 내려주므로
// 계획을 수정하거나 지우면 다음 갱신 때 캘린더에도 그대로 반영된다.
export function buildIcsFeed({
  calendarName,
  events,
}: {
  calendarName: string;
  events: CalendarFeedEvent[];
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ESS-Septo//Op Plan//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${toIcsDateTime(ev.updatedAt)}`,
      `DTSTART;VALUE=DATE:${toIcsDate(ev.date)}`,
      `DTEND;VALUE=DATE:${toIcsDate(addDays(ev.date, 1))}`,
      `SUMMARY:${escapeIcsText(ev.title)}`,
    );
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

