import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { cancelTsaScan, requestTsaScan } from "@/app/actions/hospital-link";
import { buttonStyles } from "@/lib/ui";
import { TsaScanForm } from "./tsa-scan-form";

// 병원 PC 연동 상태 — TSA 구글 시트 동기화 기록·기간 확인 요청, 병원 PC가 올린 외래 명단.
// 로그인한 본인 계정 데이터만 보인다(createdById로 거름).
type SheetRef = { date: string; chart4: string; rows: number[] };

const fmtTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function HospitalPage({ searchParams }: PageProps<"/hospital">) {
  const { userId } = await verifySession();
  const now = new Date();
  const tomorrow = kstDate(now, 1);

  const [user, runs, lists] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { tsaScanFrom: true, tsaScanTo: true, tsaScanRequestedAt: true },
    }),
    prisma.tsaRun.findMany({ where: { createdById: userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.outpatientList.findMany({
      where: { createdById: userId },
      orderBy: { date: "desc" },
      take: 14,
      select: { date: true, clinic: true, rows: true, updatedAt: true },
    }),
  ]);

  const { date: dateParam } = await searchParams;
  const selected = lists.find((l) => l.date === dateParam) ?? lists[0];
  const rows = (selected?.rows ?? []) as OutpatientRow[];

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold">병원 연동</h1>

      <section className="space-y-3">
        <h2 className="font-medium">TSA 구글 시트</h2>
        <p className="text-sm text-slate-500">
          평일 17시에 다음 날 수술장 명단의 TSA를 시트에 넣습니다. 응급·주말 수술은 아래에서 기간을 정해 확인을
          요청하세요. 병원 PC가 평일 8시~16시 50분 사이 10분마다 확인해 처리합니다. 끝 날짜는 내일까지만 됩니다.
        </p>
        {user?.tsaScanRequestedAt ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <span>
              요청됨: {user.tsaScanFrom} ~ {user.tsaScanTo} ({fmtTime.format(user.tsaScanRequestedAt)}에 요청, 처리 대기)
            </span>
            <form action={cancelTsaScan}>
              <button type="submit" className={buttonStyles.smallOutline}>
                요청 취소
              </button>
            </form>
          </div>
        ) : (
          <TsaScanForm action={requestTsaScan} defaultFrom={kstDate(now, -7)} tomorrow={tomorrow} />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-normal">실행</th>
                <th className="py-2 pr-3 font-normal">종류·기간</th>
                <th className="py-2 pr-3 font-normal">TSA</th>
                <th className="py-2 pr-3 font-normal">추가</th>
                <th className="py-2 pr-3 font-normal">이미 있음</th>
                <th className="py-2 font-normal">확인 필요</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-slate-400">
                    아직 기록이 없습니다.
                  </td>
                </tr>
              )}
              {runs.map((r) => {
                const held = r.held as SheetRef[];
                const dups = r.dups as SheetRef[];
                return (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtTime.format(r.createdAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.kind === "RANGE" ? "기간 확인" : "일일"} {r.rangeFrom === r.rangeTo ? r.rangeFrom : `${r.rangeFrom}~${r.rangeTo}`}
                    </td>
                    <td className="py-2 pr-3">{r.found}</td>
                    <td className="py-2 pr-3">{r.added}</td>
                    <td className="py-2 pr-3">{r.skipped}</td>
                    <td className="py-2">
                      {r.error && <p className="text-red-600">실패: {r.error}</p>}
                      {held.map((h, i) => (
                        <p key={`h${i}`} className="text-amber-700">
                          {h.date} …{h.chart4}: 비슷한 행이 있어 넣지 않음(시트 {h.rows.join(", ")}행)
                        </p>
                      ))}
                      {dups.map((d, i) => (
                        <p key={`d${i}`} className="text-amber-700">
                          {d.date} …{d.chart4}: 같은 환자 중복 의심(시트 {d.rows.join(", ")}행)
                        </p>
                      ))}
                      {!r.error && held.length === 0 && dups.length === 0 && <span className="text-slate-400">없음</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">외래 명단</h2>
        {lists.length === 0 ? (
          <p className="text-sm text-slate-400">아직 병원 PC가 올린 명단이 없습니다.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <Link
                  key={l.date}
                  href={`/hospital?date=${l.date}`}
                  className={l.date === selected?.date ? buttonStyles.primarySmall : buttonStyles.pill}
                >
                  {l.date.slice(5)}
                </Link>
              ))}
            </div>
            {selected && (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">
                  {selected.date} {selected.clinic} · {rows.length}명 · {fmtTime.format(selected.updatedAt)} 갱신
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-3 font-normal">시간</th>
                        <th className="py-2 pr-3 font-normal">이름</th>
                        <th className="py-2 pr-3 font-normal">등록번호</th>
                        <th className="py-2 pr-3 font-normal">초재진</th>
                        <th className="py-2 font-normal">주진단</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-2 pr-3 whitespace-nowrap">{p.time}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{p.name}</td>
                          <td className="py-2 pr-3">{p.chartNo}</td>
                          <td className="py-2 pr-3">{p.visit}</td>
                          <td className="py-2">{p.diagnosis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
