import { pcJson, pcNotFound } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { prisma } from "@/lib/prisma";
import { ClinicCalendarBodySchema } from "@/lib/clinic-schedule";

// 병원 PC가 YES 첫 화면 캘린더(내 외래일별 예약 인원)를 올린다 — 외래 스케줄 자동 판단용. 통째로 덮어씀
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();
  const parsed = ClinicCalendarBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { clinicCalendar: parsed.data.days, clinicCalendarAt: new Date() } });
  return pcJson({ ok: true, count: parsed.data.days.length });
}
