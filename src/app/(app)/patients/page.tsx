import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseFieldValues } from "@/lib/field-types";
import { procedureNameFor, type NameStyle, type SideNotation } from "@/lib/op-note-generator";
import { safeDateStr } from "@/lib/date-format";
import { buttonStyles } from "@/lib/ui";
import { PatientsListTitle } from "@/components/patients-list-title";
import { PatientListTable } from "./patient-list-table";
import type { PatientRow } from "./patient-row";

export default async function PatientsPage({
  searchParams,
}: PageProps<"/patients">) {
  const user = await getCurrentUser();
  const nameStyle: NameStyle = {
    sideNotation: user.sideNotation as SideNotation,
    abbreviateRegions: user.abbreviateRegions,
  };

  const { q, sort: sortParam, dir: dirParam } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const sort = typeof sortParam === "string" ? sortParam : "createdAt";
  const dir = dirParam === "asc" ? "asc" : dirParam === "desc" ? "desc" : "desc";

  // 수술 종류는 이름 표시에 필요한 code·name만 — 종류마다 딸린 입력 항목 정의(fields) 전체를 계획마다 끌어오지 않게.
  // 다가오는 수술은 수술 메뉴로 옮겼다(사용자 2026-10-24).
  const patients = await prisma.patient.findMany({
    where: {
      createdById: user.id,
      ...(query
        ? { OR: [{ name: { contains: query } }, { chartNo: { contains: query } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      opPlans: {
        select: {
          id: true,
          plannedDate: true,
          planData: true,
          status: true,
          surgeryType: { select: { code: true, name: true } },
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
    const procedureName = latestPlan ? procedureNameFor(latestPlan.surgeryType, latestValues, nameStyle) : null;
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
          <Link href="/patients/new" className={buttonStyles.primary}>
            + 새 환자 등록
          </Link>
        </div>
      </div>

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
