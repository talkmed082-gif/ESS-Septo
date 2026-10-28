import type { ProfSurgery } from "@/lib/prof-schedule";

// 내 주간 일정(사용자 2026-10-25) — 대시보드 맨 위 "오늘 일정"이 이 표와 그날 자료(교수님 수술·외래, 내 외래 명단, 내 수술)를 합쳐 보여 준다.
// 교수님 명단(prof-schedule PROFESSORS)처럼 코드에 둔다. 바뀌면 여기만 고치면 된다
type Duty =
  | { kind: "op-assist"; prof: string } // 교수님 수술 어시스트 → 그날 그 교수님 수술 순서대로
  | { kind: "opd-assist"; prof: string } // 교수님 외래 어시스트 → 외래 인원
  | { kind: "my-opd"; label: string } // 내 외래 → 내 외래 명단
  | { kind: "my-op"; label: string } // 내 수술 → 내 수술 계획
  | { kind: "observe" } // 스케줄 없음 → 그날 교수님 수술 전부(참관)
  | { kind: "varies" }; // 금 오전: 내 외래·내 수술·문수진 교수님 외래 어시스트 중 그날 있는 것

export const MY_WEEK: Record<number, { AM?: Duty; PM?: Duty }> = {
  1: { AM: { kind: "op-assist", prof: "박지환" }, PM: { kind: "opd-assist", prof: "문수진" } },
  2: { AM: { kind: "op-assist", prof: "문수진" }, PM: { kind: "my-opd", label: "어린이병원 외래" } },
  3: { AM: { kind: "my-op", label: "TSA 수술" }, PM: { kind: "opd-assist", prof: "박지환" } },
  4: { AM: { kind: "observe" }, PM: { kind: "opd-assist", prof: "박지환" } },
  5: { AM: { kind: "varies" } },
};

export type ProfDay = { doctor: string; outpatient: number; outpatientAm?: number | null; outpatientPm?: number | null; surgeries: ProfSurgery[]; off?: string | null };
export type MyPlan = { id: string; name: string; procedure: string };
export type DayFacts = {
  profs: ProfDay[];
  myOpd: { count: number; clinic: string | null };
  myPlans: MyPlan[];
  pause: { note: string | null } | null;
};

export type SlotLine =
  | { type: "text"; text: string; muted?: boolean }
  | { type: "surgeries"; prof: string; items: ProfSurgery[] }
  | { type: "myPlans"; items: MyPlan[] }
  | { type: "opd"; text: string; date: string };
export type Slot = { session: "오전" | "오후"; title: string; lines: SlotLine[] };

const profOf = (f: DayFacts, name: string) => f.profs.find((p) => p.doctor === name);
// 그날 교수님 자료가 하나라도 올라왔는가 — 병원 PC는 외래·수술이 있는 교수님 줄만 올리므로, 자료가 있는 날 그 교수님 줄이 없으면 외래·수술 0
const loaded = (f: DayFacts) => f.profs.length > 0;
// 교수님 쉬는 날(사용자 2026-10-25 "교수님 근무 상황도 반영"): YES 개인별복무현황조회의 부재(휴가·출장·반일 휴가)를 병원 PC가 올림(2026-10-26).
// 부재 기록이 없는데 외래·수술이 모두 0이면 휴진일 수 있다고만 표시
const offLine = (f: DayFacts, prof: string): SlotLine => {
  const off = profOf(f, prof)?.off;
  return off ? { type: "text", text: `${prof} 교수님 ${off}` } : { type: "text", text: `${prof} 교수님 그날 외래·수술 0 — 휴진일 수 있음(확인 필요)` };
};
const othersOps = (f: DayFacts, except: string): SlotLine[] => f.profs.filter((p) => p.doctor !== except && p.surgeries.length).map((p) => ({ type: "surgeries" as const, prof: p.doctor, items: p.surgeries }));

function slotFor(duty: Duty, f: DayFacts, date: string): { title: string; lines: SlotLine[] } {
  switch (duty.kind) {
    case "op-assist": {
      const p = profOf(f, duty.prof);
      const ops = p?.surgeries ?? [];
      if (ops.length) return { title: `${duty.prof} 교수님 수술 어시스트`, lines: [...(p?.off ? [offLine(f, duty.prof)] : []), { type: "surgeries", prof: duty.prof, items: ops }] };
      if (!loaded(f)) return { title: `${duty.prof} 교수님 수술 어시스트`, lines: [{ type: "text", text: "올라온 자료 없음(병원 PC가 평일 아침 2주치를 올림)", muted: true }] };
      const others = othersOps(f, duty.prof);
      return {
        title: `${duty.prof} 교수님 수술 어시스트`,
        lines: [p?.off || !p?.outpatient ? offLine(f, duty.prof) : { type: "text", text: `${duty.prof} 교수님 수술 없음(외래 ${p.outpatient}명)` }, ...(others.length ? [{ type: "text" as const, text: "다른 교수님 수술(참관):" }, ...others] : [])],
      };
    }
    case "opd-assist": {
      const p = profOf(f, duty.prof);
      if (!loaded(f)) return { title: `${duty.prof} 교수님 외래 어시스트`, lines: [{ type: "text", text: "외래 인원 자료 없음", muted: true }] };
      if (!p?.outpatient) return { title: `${duty.prof} 교수님 외래 어시스트`, lines: [p?.off || !p?.surgeries.length ? offLine(f, duty.prof) : { type: "text", text: `${duty.prof} 교수님 외래 0명(수술 ${p.surgeries.length}건)` }] };
      return { title: `${duty.prof} 교수님 외래 어시스트`, lines: [...(p.off ? [offLine(f, duty.prof)] : []), { type: "text", text: `외래 ${p.outpatient}명` }] };
    }
    case "my-opd":
      return { title: duty.label, lines: [f.myOpd.count ? { type: "opd", text: `내 외래 ${f.myOpd.count}명${f.myOpd.clinic ? ` · ${f.myOpd.clinic}` : ""}`, date } : { type: "text", text: "외래 명단 없음", muted: true }] };
    case "my-op":
      return { title: duty.label, lines: f.myPlans.length ? [{ type: "myPlans", items: f.myPlans }] : [{ type: "text", text: "이 사이트에 잡힌 수술 없음", muted: true }] };
    case "observe": {
      const any = f.profs.filter((p) => p.surgeries.length);
      return { title: "스케줄 없음 — 다른 수술 있으면 참관", lines: any.length ? any.map((p) => ({ type: "surgeries" as const, prof: p.doctor, items: p.surgeries })) : [{ type: "text", text: "교수님 수술 없음", muted: true }] };
    }
    case "varies": {
      const lines: SlotLine[] = [];
      if (f.myOpd.count) lines.push({ type: "opd", text: `내 외래 ${f.myOpd.count}명${f.myOpd.clinic ? ` · ${f.myOpd.clinic}` : ""}`, date });
      if (f.myPlans.length) lines.push({ type: "myPlans", items: f.myPlans });
      const moon = profOf(f, "문수진")?.outpatient ?? 0;
      if (profOf(f, "문수진")?.off) lines.push(offLine(f, "문수진"));
      else if (moon) lines.push({ type: "text", text: `문수진 교수님 외래 ${moon}명 — 어시스트 확인` });
      if (!lines.length) lines.push({ type: "text", text: "내 외래·수술·문수진 교수님 외래 모두 없음", muted: true });
      return { title: "내 외래 / 수술 / 문수진 교수님 외래 어시스트", lines };
    }
  }
}

// 그날 일정 칸(오전·오후). 쉬는 날(출장·휴가)이면 그것만
export function myDay(date: string, f: DayFacts): Slot[] {
  if (f.pause) return [{ session: "오전", title: `쉬는 날${f.pause.note ? ` — ${f.pause.note}` : ""}`, lines: [] }];
  const week = MY_WEEK[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? {};
  const out: Slot[] = [];
  if (week.AM) out.push({ session: "오전", ...slotFor(week.AM, f, date) });
  if (week.PM) out.push({ session: "오후", ...slotFor(week.PM, f, date) });
  return out;
}

// 보여 줄 날: 평일이면 오늘, 주말이면 다음 월요일
export function scheduleDay(today: string): string {
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay();
  const add = wd === 6 ? 2 : wd === 0 ? 1 : 0;
  return new Date(Date.parse(`${today}T00:00:00Z`) + add * 86_400_000).toISOString().slice(0, 10);
}

// 달력 칸의 교수님별 줄 "박 오전 수술 1"·"박 오후 외래 11"·"문 연차"(성 한 글자, 사용자 2026-10-28).
// 오전/오후는 병원 PC가 보낼 때만 붙는다 — 없으면 "박 수술 1"·"박 외래 11"
export function profCellLines(profs: ProfDay[]): string[] {
  const OFF: Record<string, string> = { "반일 휴가": "반차?", 반차: "반차?" };
  const out: string[] = [];
  for (const p of profs) {
    const i = p.doctor.slice(0, 1);
    if (p.off) out.push(`${i} ${OFF[p.off] ?? p.off}`);
    for (const h of ["오전", "오후", undefined] as const) {
      const n = p.surgeries.filter((s) => s.half === h).length;
      if (n) out.push(`${i} ${h ? `${h} ` : ""}수술 ${n}`);
    }
    if (p.outpatientAm != null || p.outpatientPm != null) {
      if (p.outpatientAm) out.push(`${i} 오전 외래 ${p.outpatientAm}`);
      if (p.outpatientPm) out.push(`${i} 오후 외래 ${p.outpatientPm}`);
    } else if (p.outpatient) out.push(`${i} 외래 ${p.outpatient}`);
  }
  return out;
}
