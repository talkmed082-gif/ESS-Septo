import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { PatientListTable, type PatientRow } from "./patient-list-table";

function toDateStr(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function PatientsPage({
  searchParams,
}: PageProps<"/patients">) {
  await verifySession();
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
    include: { opPlans: { select: { id: true, status: true, plannedDate: true } } },
  });

  const rows: PatientRow[] = patients.map((p) => {
    const dates = p.opPlans.map((pl) => pl.plannedDate).filter((d): d is Date => d !== null);
    const latest = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    return {
      id: p.id,
      name: p.name,
      chartNo: p.chartNo,
      sex: p.sex,
      birthDate: toDateStr(p.birthDate),
      surgeryDate: toDateStr(latest),
      planCount: p.opPlans.length,
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
      case "sex":
        av = a.sex ?? "";
        bv = b.sex ?? "";
        break;
      case "birthDate":
        av = a.birthDate ?? "";
        bv = b.birthDate ?? "";
        break;
      case "surgeryDate":
        av = a.surgeryDate ?? "";
        bv = b.surgeryDate ?? "";
        break;
      case "planCount":
        av = a.planCount;
        bv = b.planCount;
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
        <h1 className="text-xl font-semibold">환자 목록</h1>
        <Link
          href="/patients/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + 새 환자 등록
        </Link>
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="이름 또는 차트번호로 검색"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </form>

      <PatientListTable patients={sortedRows} query={query} sort={sort} dir={dir} />
    </div>
  );
}
