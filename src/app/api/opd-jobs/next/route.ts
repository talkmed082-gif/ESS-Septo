import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { kstDate, type OutpatientRow } from "@/lib/hospital-link";
import { isClaimable, jobWhere } from "@/lib/opd-jobs";
import { claimClinicAsk } from "@/lib/clinic-ask-store";

// POST: 오늘 일감 하나를 가져간다(처리 중으로 바꿈). 없으면 { job: null }
//  - 노트북 작업자: 쿼리 없음 → 노트북 일감만
//  - 진료실 PC: ?where=clinic&chart=지금 EMR에 열린 환자 → 그 환자의 진료실 일감만
// 노트북은 같은 묻기로 폰 [Claude에게 묻기] 질문도 하나 받는다(ask, 요청을 따로 늘리지 않음). ?asksOnly=1 = EMR 작업 중이라 질문만, ?noAsks=1 = 답하는 중이라 일감만
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const sp = new URL(request.url).searchParams;
  const where = sp.get("where") === "clinic" ? "clinic" : "laptop";
  const chart = (sp.get("chart") ?? "").trim().replace(/^0+/, "");
  if (where === "clinic" && !/^\d{3,12}$/.test(chart)) return pcJson({ job: null });
  const now = new Date();
  // 진료실 PC가 환자 기록지를 새로 열었다(&opened=1, 환자가 바뀐 첫 묻기) → 진료 브리핑 진료 상태
  if (where === "clinic" && sp.get("opened") === "1") {
    const visitDate = kstDate(now);
    await prisma.clinicMark.upsert({
      where: { createdById_visitDate_chartNo: { createdById: user.id, visitDate, chartNo: chart } },
      create: { createdById: user.id, visitDate, chartNo: chart, openedAt: now },
      update: { openedAt: now },
    });
  }
  const ask =where === "laptop" && sp.get("noAsks") !== "1" ? await claimClinicAsk(user.id, now) : null;
  if (sp.get("asksOnly") === "1") return pcJson({ job: null, ask });
  const jobs = (
    await prisma.opdJob.findMany({
      where: { createdById: user.id, visitDate: kstDate(now), status: { in: ["pending", "waiting", "running"] } },
      orderBy: { createdAt: "asc" },
    })
  ).filter((j) => jobWhere(j.tasks) === where && (where === "laptop" || j.chartNo.replace(/^0+/, "") === chart));
  const job = jobs.find((j) => j.status === "pending") ?? jobs.find((j) => isClaimable(j, now, where));
  if (!job || !isClaimable(job, now, where)) return pcJson({ job: null, ask });
  // 같은 일감을 두 번 가져가지 않게 — 상태가 그대로일 때만 바꾼다
  const r = await prisma.opdJob.updateMany({ where: { id: job.id, status: job.status, updatedAt: job.updatedAt }, data: { status: "running", tries: { increment: 1 } } });
  if (r.count === 0) return pcJson({ job: null, ask });
  // 재진 SOAP 요약(tasks.soap)용 — 그날 외래 명단의 그 환자 SOAP 글(없으면 빈 값 → 작업자가 이전 기록으로)
  const list = await prisma.outpatientList.findUnique({ where: { createdById_date: { createdById: user.id, date: job.visitDate } }, select: { rows: true } });
  const soap = ((list?.rows ?? []) as OutpatientRow[]).find((x) => x.chartNo.replace(/^0+/, "") === job.chartNo.replace(/^0+/, ""))?.soap ?? "";
  return pcJson({ job: { id: job.id, chartNo: job.chartNo, name: job.name, visit: job.visit, templateId: job.templateId, tasks: job.tasks, practice: job.practice, tries: job.tries + 1, soap }, ask });
}
