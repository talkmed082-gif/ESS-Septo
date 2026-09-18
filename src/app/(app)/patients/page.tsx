import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

export default async function PatientsPage({
  searchParams,
}: PageProps<"/patients">) {
  await verifySession();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

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
    include: { opPlans: { select: { id: true, status: true } } },
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

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">차트번호</th>
              <th className="px-4 py-2 font-medium">성별</th>
              <th className="px-4 py-2 font-medium">생년월일</th>
              <th className="px-4 py-2 font-medium">수술계획</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/patients/${p.id}`} className="font-medium text-slate-900 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{p.chartNo ?? "-"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {p.sex === "M" ? "남" : p.sex === "F" ? "여" : "-"}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {p.birthDate ? p.birthDate.toISOString().slice(0, 10) : "-"}
                </td>
                <td className="px-4 py-2 text-slate-600">{p.opPlans.length}건</td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  등록된 환자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
