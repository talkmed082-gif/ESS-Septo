import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { OpdJobSubmitSchema } from "@/lib/opd-jobs";

// GET ?date= : 그날 외래 명단 + 맡긴 일감 상태(진료 어시스트 [오늘 외래])
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const date = new URL(request.url).searchParams.get("date") || kstDate(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return pcJson({ error: "날짜가 올바르지 않습니다." }, { status: 400 });
  const [list, jobs] = await Promise.all([
    prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: user.id, date } }, select: { clinic: true, rows: true } }),
    prisma.opdJob.findMany({ where: { createdById: user.id, visitDate: date } }),
  ]);
  const byChart = new Map(jobs.map((j) => [j.chartNo, j]));
  const rows = ((list?.rows ?? []) as OutpatientRow[]).map((r) => {
    const j = byChart.get(r.chartNo);
    return { time: r.time, name: r.name, chartNo: r.chartNo, visit: r.visit, diagnosis: r.diagnosis, job: j ? { status: j.status, result: j.result, templateId: j.templateId, practice: j.practice } : null };
  });
  return pcJson({ date, clinic: list?.clinic ?? null, rows });
}

// POST: 고른 환자들을 노트북에 맡긴다(같은 날 같은 환자는 새로 덮어써 다시 대기)
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = OpdJobSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const { visitDate, practice, items } = parsed.data;
  for (const it of items) {
    const data = { name: it.name, visit: it.visit, templateId: it.templateId, tasks: it.tasks, practice, status: "pending", result: null, tries: 0 };
    await prisma.opdJob.upsert({
      where: { createdById_visitDate_chartNo: { createdById: user.id, visitDate, chartNo: it.chartNo } },
      create: { ...data, visitDate, chartNo: it.chartNo, createdById: user.id },
      update: data,
    });
  }
  return pcJson({ ok: true, count: items.length });
}
