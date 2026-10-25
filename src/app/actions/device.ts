"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { issueDeviceOtp } from "@/lib/device-auth";

// [새 번호] — 오늘의 번호가 새었을 때 바로 바꾼다(전 번호는 무효, 이미 연결된 프로그램은 그대로)
export async function rotateOtp(): Promise<void> {
  const session = await verifySession();
  await issueDeviceOtp(session.userId);
  revalidatePath("/", "layout");
}

// 연결된 진료실 PC 프로그램을 모두 끊는다(PC를 두고 왔을 때)
export async function endAllDeviceSessions(): Promise<void> {
  const session = await verifySession();
  await prisma.deviceSession.deleteMany({ where: { createdById: session.userId } });
  revalidatePath("/dashboard");
}
