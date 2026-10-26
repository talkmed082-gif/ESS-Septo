import type { Metadata } from "next";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { safeDateStr } from "@/lib/date-format";
import { latestRoadmaps } from "@/lib/roadmap-store";
import { patientRoadmaps } from "@/lib/pathway-store";
import { pathwayById, summaryLine } from "@/lib/pathways";
import { parseRoadmap, parseSoap } from "@/lib/clinic-view";
import { clinicOrder } from "@/lib/clinic-ask";
import { PhoneClinic, type MPatient } from "./phone-clinic";

export const metadata: Metadata = { title: "폰 진료" };

// 폰 진료 화면(사용자 2026-10-26) — 외래 중 폰에 띄워 둔다. 번호 = 그날 명단 시간 순서(진료 어시스트가 "지금 N번"을 띄움).
// 그날 환자 전부를 한 번에 읽어 두고 번호로 바꿔 본다(환자마다 사이트를 다시 묻지 않음). 본인 데이터만
export default async function PhoneClinicPage({ searchParams }: PageProps<"/m">) {
  const { userId } = await verifySession();
  const { date: dateParam } = await searchParams;
  const today = kstDate(new Date());
  const asked = typeof dateParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const sel = { date: true, clinic: true, rows: true } as const;
  const list = asked
    ? await prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: userId, date: asked } }, select: sel })
    : ((await prisma.outpatientList.findMany({ where: { createdById: userId, date: { gte: today } }, orderBy: { date: "asc" }, take: 14, select: sel })).find(
        (l) => (l.rows as OutpatientRow[]).length > 0,
      ) ?? null);
  const date = asked ?? list?.date ?? today;
  const rows = clinicOrder((list?.rows ?? []) as OutpatientRow[]);
  const charts = rows.map((r) => r.chartNo);

  const [roadmaps, pathwayData, cares, plans] = await Promise.all([
    latestRoadmaps(userId, charts),
    patientRoadmaps(userId, charts),
    prisma.patientCare.findMany({ where: { createdById: userId, chartNo: { in: charts } }, select: { chartNo: true, planType: true, nextVisit: true } }),
    prisma.opPlan.findMany({
      where: { createdById: userId, patient: { chartNo: { in: charts } } },
      select: { plannedDate: true, status: true, patient: { select: { chartNo: true } }, surgeryType: { select: { name: true } }, opRecord: { select: { operationDate: true } } },
    }),
  ]);
  const careBy = new Map(cares.map((c) => [c.chartNo, c]));

  const patients: MPatient[] = rows.map((r, i) => {
    const rm = roadmaps.get(r.chartNo);
    const text = rm?.text ?? r.roadmap ?? "";
    const rp = parseRoadmap(text);
    const soap = parseSoap(r.soap);
    const pw = pathwayData.get(r.chartNo) ?? { pathways: [], visits: [] };
    const care = careBy.get(r.chartNo);
    return {
      no: i + 1,
      time: r.time,
      name: r.name,
      chartNo: r.chartNo,
      visit: r.visit,
      diagnosis: r.diagnosis,
      summary: summaryLine(text) ?? rp.summary,
      core: soap.core,
      now: rp.now,
      check: rp.check,
      todo: rp.todo,
      roadmap: rm ? { id: rm.id, done: rm.done } : null,
      soap: { S: soap.S, O: soap.O, A: soap.A, P: soap.P },
      course: rp.course,
      stages: pw.pathways.map((p) => {
        const def = pathwayById(p.pathwayId);
        return `${def?.name ?? p.pathwayId} · ${def?.stages.find((s) => s.id === p.stageId)?.name ?? p.stageId}`;
      }),
      visits: [...pw.visits].reverse().slice(0, 6).map((v) => ({ date: v.visitDate, summary: v.summary })),
      surgeries: plans
        .filter((p) => p.patient.chartNo === r.chartNo)
        .flatMap((p) => {
          const d = safeDateStr(p.opRecord?.operationDate ?? p.plannedDate);
          return d ? [{ date: d, name: p.surgeryType.name, done: !!p.opRecord || p.status === "DONE" }] : [];
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
      nextVisit: care?.nextVisit ?? null,
    };
  });

  return <PhoneClinic date={date} today={today} clinic={list?.clinic ?? ""} patients={patients} />;
}
