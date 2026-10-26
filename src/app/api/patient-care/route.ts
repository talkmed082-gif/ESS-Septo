import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { kstDate } from "@/lib/hospital-link";
import { NEXT_VISIT_OPTIONS, nextClinicDate, nextClinicDatesByWeekday, PatientCareBodySchema } from "@/lib/clinic-schedule";
import { effectiveSchedule } from "@/lib/clinic-schedule-store";

// GET: 진료실 프로그램의 다음 외래 버튼(2주~6개월) 날짜 — 내 외래 스케줄과 휴진 기간(자동화 쉬는 날)으로 계산
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const today = kstDate(new Date());
  // 스케줄 = 손으로 저장한 것, 없으면 외래 예약 명단으로 자동 판단(effectiveSchedule)
  const [{ schedule, source }, pauses] = await Promise.all([
    effectiveSchedule(user.id),
    prisma.automationPause.findMany({ where: { createdById: user.id, to: { gte: today } }, select: { from: true, to: true } }),
  ]);
  return pcJson({
    hasSchedule: schedule.length > 0,
    scheduleSource: source,
    // next = 가장 이른 외래일(예전 진료실 프로그램도 이것만 씀), byWeekday = 요일마다 가장 가까운 외래일(화·금 둘 다 고르기)
    options: NEXT_VISIT_OPTIONS.map((o) => ({
      ...o,
      next: nextClinicDate(today, o.days, schedule, pauses),
      byWeekday: nextClinicDatesByWeekday(today, o.days, schedule, pauses),
    })),
  });
}

// POST: 그 환자의 Plan(수술/약물치료/경과관찰)·다음 외래를 저장(보낸 칸만 바꿈)
export async function POST(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const parsed = PatientCareBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const { chartNo, ...data } = parsed.data;
  const care = await prisma.patientCare.upsert({
    where: { createdById_chartNo: { createdById: user.id, chartNo } },
    create: { chartNo, ...data, createdById: user.id },
    update: data,
    select: { planType: true, nextVisit: true, nextVisitLabel: true },
  });
  return pcJson(care);
}
