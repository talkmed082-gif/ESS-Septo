import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { kstDate } from "@/lib/hospital-link";
import { isClaimable } from "@/lib/opd-jobs";

// POST: 노트북 작업자가 오늘 일감 하나를 가져간다(처리 중으로 바꿈). 없으면 { job: null }
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const now = new Date();
  const jobs = await prisma.opdJob.findMany({
    where: { createdById: user.id, visitDate: kstDate(now), status: { in: ["pending", "waiting", "running"] } },
    orderBy: { createdAt: "asc" },
  });
  const job = jobs.find((j) => j.status === "pending") ?? jobs.find((j) => isClaimable(j, now));
  if (!job || !isClaimable(job, now)) return pcJson({ job: null });
  // 같은 일감을 두 번 가져가지 않게 — 상태가 그대로일 때만 바꾼다
  const r = await prisma.opdJob.updateMany({ where: { id: job.id, status: job.status, updatedAt: job.updatedAt }, data: { status: "running", tries: { increment: 1 } } });
  if (r.count === 0) return pcJson({ job: null });
  return pcJson({ job: { id: job.id, chartNo: job.chartNo, visit: job.visit, templateId: job.templateId, tasks: job.tasks, practice: job.practice, tries: job.tries + 1 } });
}
