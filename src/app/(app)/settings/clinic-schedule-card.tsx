import { saveClinicSchedule } from "@/app/actions/clinic-schedule";
import type { ClinicSession } from "@/lib/clinic-schedule";
import { buttonStyles } from "@/lib/ui";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 내 외래 스케줄 — 진료실 프로그램의 다음 외래 버튼(2주~6개월)이 이 요일 중 가장 가까운 날을 고른다. 휴진은 "자동화 쉬는 날".
// 격주(금 오전 등)는 칸 아래 "격주"를 켜고 기준일(외래가 있는 날 하나)을 넣는다
export function ClinicScheduleCard({
  schedule,
  historyDays,
  inUse,
}: {
  schedule: ClinicSession[];
  historyDays: string;
  inUse: { source: "manual" | "auto" | "none"; text: string };
}) {
  const on = (wd: number, s: "AM" | "PM") => schedule.some((x) => x.weekday === wd && x.session === s);
  const biweekly = (wd: number, s: "AM" | "PM") => schedule.some((x) => x.weekday === wd && x.session === s && x.everyOtherFrom);
  const anchor = schedule.find((x) => x.everyOtherFrom)?.everyOtherFrom ?? "";
  return (
    <form action={saveClinicSchedule} className="space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <p className="text-sm text-slate-700">
        다음 외래 계산에 쓰는 스케줄:{" "}
        {inUse.source === "none" ? (
          <span className="text-slate-400">아직 없음(외래 명단·예약이 올라오면 자동으로 잡힘)</span>
        ) : (
          <>
            <span className="font-medium">{inUse.text}</span>{" "}
            <span className="text-xs text-slate-400">
              {inUse.source === "auto" ? "— 외래 예약 명단으로 자동(아래를 저장하면 저장한 것을 씀)" : "— 아래에 저장한 것(모두 끄고 저장하면 자동으로)"}
            </span>
          </>
        )}
      </p>
      <table className="text-center">
        <thead>
          <tr>
            <th />
            {[1, 2, 3, 4, 5, 6].map((wd) => (
              <th key={wd} className="px-2 font-normal text-slate-500">
                {DAYS[wd]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["AM", "PM"] as const).map((s) => (
            <tr key={s}>
              <td className="pr-2 text-slate-500">{s === "AM" ? "오전" : "오후"}</td>
              {[1, 2, 3, 4, 5, 6].map((wd) => (
                <td key={wd} className="px-2 align-top">
                  <input type="checkbox" name={`s-${wd}-${s}`} defaultChecked={on(wd, s)} aria-label={`${DAYS[wd]} ${s === "AM" ? "오전" : "오후"}`} />
                  <label className="block text-[10px] whitespace-nowrap text-slate-400">
                    <input type="checkbox" name={`bw-${wd}-${s}`} defaultChecked={biweekly(wd, s)} className="mr-0.5 align-middle" aria-label={`${DAYS[wd]} ${s === "AM" ? "오전" : "오후"} 격주`} />
                    격주
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <label className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        격주 기준일(외래가 있는 날 하나)
        <input type="date" name="bwAnchor" defaultValue={anchor} className="rounded border border-slate-300 px-2 py-0.5 text-xs" />
      </label>
      {historyDays && <p className="text-xs text-slate-400">최근 외래 명단 기준 외래 요일: {historyDays}</p>}
      <p className="text-xs text-slate-400">휴진(학회·휴가)은 위 &quot;병원 PC 자동화 쉬는 날&quot;에 넣으면 다음 외래 날짜에서 빠집니다.</p>
      <button type="submit" className={buttonStyles.primarySmall}>
        저장
      </button>
    </form>
  );
}
