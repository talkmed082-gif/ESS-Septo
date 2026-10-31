"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { checkOncallTimes, isYmd } from "@/lib/er-visits";

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

// [온콜대장 신청] — 승인 버튼(사용자 2026-10-31). 병원 PC가 10분 확인 때 부서행정 온콜대장에 한 줄 저장한다(같은 날·같은 환자 줄이 있으면 안 넣음).
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
  const r = await prisma.erVisit.updateMany({
    where: {
      id: String(formData.get("id") ?? ""),
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
