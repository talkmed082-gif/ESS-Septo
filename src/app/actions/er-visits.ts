"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { checkOncallTimes, erOncallBlock, isYmd } from "@/lib/er-visits";
import { getErDuty } from "@/lib/er-visits-store";

// "응급실 환자 가져오기" — 병원 PC가 10분 확인 때 그날 응급실 환자 중 담당의가 동반당직자인 환자에서 내 기록지가 있는 환자를 올린다.
// 다시 누르면 날짜·요청 시각만 바뀐다
export async function requestErCheck(formData: FormData): Promise<void> {
  const session = await verifySession();
  const date = String(formData.get("date") ?? "");
  if (!isYmd(date)) return;
  await prisma.user.update({ where: { id: session.userId }, data: { erCheckDate: date, erCheckRequestedAt: new Date() } });
  revalidatePath("/er");
}

export async function cancelErCheck(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({ where: { id: session.userId }, data: { erCheckRequestedAt: null } });
  revalidatePath("/er");
}

export interface ErOncallFormState {
  message?: string;
}

// [온콜대장 신청] — 승인 버튼(사용자 2026-10-31). 근무(일직·숙직)마다 한 명. 병원 PC가 10분 확인 때 부서행정 온콜대장에 한 줄 저장한다(같은 날·같은 환자 줄이 있으면 안 넣음).
// 신청 전이거나 실패한 것만. 다시 신청하면 시각·요청 시각만 바뀐다
export async function requestErOncall(_prev: ErOncallFormState | undefined, formData: FormData): Promise<ErOncallFormState> {
  const session = await verifySession();
  const t = {
    call: String(formData.get("call") ?? ""),
    arrive: String(formData.get("arrive") ?? ""),
    end: String(formData.get("end") ?? ""),
  };
  const bad = checkOncallTimes(t);
  if (bad) return { message: bad.error };
  const id = String(formData.get("id") ?? "");
  // 근무마다 한 명(휴일 일직·숙직, 평일 숙직 — 당직표의 내 당직 종류)
  const v = await prisma.erVisit.findFirst({ where: { id, createdById: session.userId }, select: { id: true, date: true, shift: true } });
  if (!v) return { message: "환자를 찾지 못했습니다. 화면을 새로 고쳐 주세요." };
  const [sameDay, duty] = await Promise.all([
    prisma.erVisit.findMany({ where: { createdById: session.userId, date: v.date }, select: { id: true, shift: true, oncallStatus: true } }),
    getErDuty(session.userId, v.date),
  ]);
  const blocked = erOncallBlock(v, sameDay, duty.myShifts);
  if (blocked) return { message: blocked };
  const r = await prisma.erVisit.updateMany({
    where: {
      id,
      createdById: session.userId,
      OR: [{ oncallStatus: null }, { oncallStatus: { in: ["PENDING", "FAILED"] } }],
    },
    data: { ...t, oncallStatus: "PENDING", oncallRequestedAt: new Date(), oncallMessage: null },
  });
  if (r.count === 0) return { message: "이미 온콜대장에 저장된 환자입니다. 고치려면 부서행정에서 직접 하세요." };
  revalidatePath("/er");
  return {};
}

export async function cancelErOncall(formData: FormData): Promise<void> {
  const session = await verifySession();
  await prisma.erVisit.updateMany({
    where: { id: String(formData.get("id") ?? ""), createdById: session.userId, oncallStatus: "PENDING" },
    data: { oncallStatus: null, oncallRequestedAt: null },
  });
  revalidatePath("/er");
}

// 응급실 현황 [새로고침] — 병원 PC가 10분 확인 때 지금 응급실에 있는 환자 목록을 다시 올리고 비운다
export async function requestErNow(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({ where: { id: session.userId }, data: { erNowRequestedAt: new Date() } });
  revalidatePath("/er");
}
