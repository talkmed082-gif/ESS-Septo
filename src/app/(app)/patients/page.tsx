import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { isBuiltInSurgeryCode } from "@/lib/op-note-defs";
import { buildProcedureName, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { PatientsListTitle } from "@/components/patients-list-title";
import { PatientListTable, isPlanDone, type PatientRow } from "./patient-list-table";

export default async function PatientsPage({
  searchParams,
}: PageProps<"/patients">) {
  const user = await getCurrentUser();
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };
  const todayUtc = new Date(new Date().toISOString().slice(0, 10));

  const upcomingPlans = await prisma.opPlan.findMany({
    // "완료"로 표시해둔 계획은 기록지를 아직 안 썼어도 더 이상 "다가오는
    // 수술"이 아니므로 제외한다.
    where: { plannedDate: { gte: todayUtc }, opRecord: null, status: { not: "DONE" } },
    orderBy: { plannedDate: "asc" },
    take: 10,
    include: { patient: true, surgeryType: true },
  });

  const { q, sort: sortParam, dir: dirParam } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const sort = typeof sortParam === "string" ? sortParam : "createdAt";
  const dir = dirParam === "asc" ? "asc" : dirParam === "desc" ? "desc" : "desc";

  const patients = await prisma.patient.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { chartNo: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      opPlans: {
        select: {
          id: true,
          plannedDate: true,
          planData: true,
          status: true,
          surgeryType: true,
          opRecord: { select: { id: true } },
        },
      },
    },
  });

  const rows: PatientRow[] = patients.map((p) => {
    const withDates = p.opPlans.filter(
      (pl): pl is typeof pl & { plannedDate: Date } => pl.plannedDate !== null,
    );
    const latestPlan =
      withDates.length > 0
        ? withDates.reduce((a, b) => (a.plannedDate > b.plannedDate ? a : b))
        : (p.opPlans[0] ?? null);
    const latestValues = latestPlan ? parseFieldValues(latestPlan.planData) : {};
    const procedureName = latestPlan
      ? isBuiltInSurgeryCode(latestPlan.surgeryType.code)
        ? buildProcedureName(latestPlan.surgeryType.code, latestValues, nameStyle)
        : latestPlan.surgeryType.name
      : null;
    return {
      id: p.id,
      name: p.name,
      chartNo: p.chartNo,
      sex: p.sex,
      age: p.age,
      surgeryDate: safeDateStr(latestPlan?.plannedDate),
      surgeryPlanId: latestPlan?.id ?? null,
      procedureName,
      recordId: latestPlan?.opRecord?.id ?? null,
      planDone: latestPlan?.status === "DONE",
    };
  });

  const dirMul = dir === "asc" ? 1 : -1;
  const sortedRows = [...rows].sort((a, b) => {
    // 정렬 기준과 무관하게, 예정인 수술을 항상 위에 두고 완료된 수술은
    // 아래로 모아서 보여준다 — 그 안에서만 선택한 열로 다시 정렬한다.
    const doneDiff = Number(isPlanDone(a)) - Number(isPlanDone(b));
    if (doneDiff !== 0) return doneDiff;

    let av: string | number = "";
    let bv: string | number = "";
    switch (sort) {
      case "name":
        av = a.name;
        bv = b.name;
        break;
      case "chartNo":
        av = a.chartNo ?? "";
        bv = b.chartNo ?? "";
        break;
      case "age":
        av = a.age ?? -1;
        bv = b.age ?? -1;
        break;
      case "surgeryDate":
        av = a.surgeryDate ?? "";
        bv = b.surgeryDate ?? "";
        break;
      case "procedureName":
        av = a.procedureName ?? "";
        bv = b.procedureName ?? "";
        break;
      default:
        return 0;
    }
    if (av < bv) return -1 * dirMul;
    if (av > bv) return 1 * dirMul;
    return 0;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PatientsListTitle />
        <div className="flex items-center gap-3">
          {/* "선택한 환자 Op Plan 인쇄"(체크한 환자로 채워서 인쇄)와 헷갈리지
              않도록, 환자 데이터 없이 빈 칸으로 인쇄하는 이 링크는 "빈"을
              명시한다. */}
          <Link href="/print/fess-checklist" className={buttonStyles.secondarySmall}>
            빈 체크리스트 양식 인쇄
          </Link>
          <Link href="/patients/new" className={buttonStyles.primary}>
            + 새 환자 등록
          </Link>
        </div>
      </div>

      {upcomingPlans.length > 0 && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-emerald-900">
            다가오는 수술 ({upcomingPlans.length}건)
          </h2>
          <ul className="space-y-2">
            {upcomingPlans.map((plan) => {
              const code = plan.surgeryType.code;
              const values = parseFieldValues(plan.planData);
              const procedureName = isBuiltInSurgeryCode(code)
                ? buildProcedureName(code, values, nameStyle)
                : plan.surgeryType.name;
              return (
                <li key={plan.id} className="flex items-center justify-between text-sm">
                  <Link href={`/plans/${plan.id}`} className="hover:underline">
                    <span className="font-medium text-slate-900">
                      {safeDateStr(plan.plannedDate)}
                    </span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="text-slate-900">{plan.patient.name}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="text-slate-600">{procedureName}</span>
                  </Link>
                  <Link
                    href={`/plans/${plan.id}/record`}
                    className={`shrink-0 ${buttonStyles.smallOutlineAccent}`}
                  >
                    기록지 작성
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form className="mb-3 flex max-w-sm gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="이름 또는 차트번호로 검색"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button type="submit" className={buttonStyles.secondarySmall}>
          검색
        </button>
      </form>
      {query && (
        <p className="mb-4 text-sm text-slate-500">
          &ldquo;{query}&rdquo; 검색 결과 {patients.length}건
          <Link href="/patients" className="ml-2 underline">
            검색 지우기
          </Link>
        </p>
      )}

      <PatientListTable patients={sortedRows} query={query} sort={sort} dir={dir} />
    </div>
  );
}
