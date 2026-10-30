import * as z from "zod";

// 이비인후과 의사 당직표 — 병원 PC(duty_sync.ps1)가 YES 부서행정 → 근무상황관리 → 의사직 당직근무자 조회
// (Pk_Work.Work_S122, 부서 ENT)를 이번 달·다음 달치 올린다(사용자 2026-10-31 "내 당직일마다 누가 같이 당직인지").
// 전화번호 칸은 안 읽는다. 사번은 같은 이름 구분용으로만
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const DutyItemSchema = z.object({
  date: ymd,
  empNo: z.string().min(1).max(20),
  name: z.string().min(1).max(20),
  kind: z.string().min(1).max(20), // "평일 숙직"·"휴일 숙직"·"휴일 일직"
  time: z.string().max(40).optional().default(""),
});
export type DutyItem = z.infer<typeof DutyItemSchema>;

export const DutyRosterBodySchema = z.object({
  from: ymd,
  to: ymd,
  items: z.array(DutyItemSchema).max(2000),
});

// 한 사람의 그날 당직 — "휴일 일직"+"휴일 숙직"이면 kinds ["일직", "숙직"]
export type DutyPerson = { name: string; kinds: string[] };
// 내 당직일만: 내 당직 종류와 같이 서는 사람들
export type DutyDay = { mine: string[]; mates: DutyPerson[] };

const ORDER = ["일직", "숙직"];
const shortKind = (kind: string) => ORDER.find((k) => kind.includes(k)) ?? kind;

// 날짜별로 묶어 내(이름 = 계정 이름) 당직이 있는 날만 돌려준다. 같은 날 같이 서는 사람은 당직 종류가 달라도 모두(일직만 같이 서는 사람 포함)
export function myDutyDays(rows: Pick<DutyItem, "date" | "name" | "kind">[], myName: string): Map<string, DutyDay> {
  const byDate = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    const people = byDate.get(r.date) ?? new Map<string, Set<string>>();
    people.set(r.name, (people.get(r.name) ?? new Set()).add(shortKind(r.kind)));
    byDate.set(r.date, people);
  }
  const sortKinds = (s: Set<string>) => [...s].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const out = new Map<string, DutyDay>();
  for (const [date, people] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    const mine = people.get(myName);
    if (!mine) continue;
    const mates = [...people]
      .filter(([n]) => n !== myName)
      .map(([name, kinds]) => ({ name, kinds: sortKinds(kinds) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    out.set(date, { mine: sortKinds(mine), mates });
  }
  return out;
}
