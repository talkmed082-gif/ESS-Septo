import { NextResponse } from "next/server";
import { findUserByImportToken } from "@/lib/import-auth";
import { applyReminderSync, getReminderSyncTargets, ReminderSyncBodySchema } from "@/lib/reminder-sync-store";

// 병원 PC 스크립트가 EMR Reminder와 이 사이트 리마인더를 맞추는 입구(인증은 schedule-import와 같은 토큰).
// GET: 동기화할 환자 등록번호와 EMR에 아직 안 올라간 리마인더. POST: EMR 반영 결과.
export async function GET(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return notFound();
  return NextResponse.json(await getReminderSyncTargets(user.id));
}

export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return notFound();

  const parsed = ReminderSyncBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return NextResponse.json(await applyReminderSync(user.id, parsed.data));
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}
