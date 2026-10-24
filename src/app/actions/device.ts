"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { issueDeviceOtp } from "@/lib/device-auth";

export type OtpState = { code: string; until: string } | undefined;

// 진료실 PC 프로그램 연결 코드(6자리, 5분, 한 번만) — 새로 받으면 전 코드는 무효
export async function issueOtp(): Promise<OtpState> {
  const session = await verifySession();
  const { code, minutes } = await issueDeviceOtp(session.userId);
  const until = new Date(Date.now() + minutes * 60000).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  return { code, until };
}

// 연결된 진료실 PC 프로그램을 모두 끊는다(PC를 두고 왔을 때)
export async function endAllDeviceSessions(): Promise<void> {
  const session = await verifySession();
  await prisma.deviceSession.deleteMany({ where: { createdById: session.userId } });
  revalidatePath("/otp");
}
