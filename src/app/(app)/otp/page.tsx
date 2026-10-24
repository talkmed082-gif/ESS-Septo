import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { endAllDeviceSessions } from "@/app/actions/device";
import { OtpCard } from "./otp-card";

// OTP 받기 — 진료실 PC 프로그램(외래 도우미) 연결 코드. 로그인 후 첫 화면이다(사용자 2026-10-24:
// 예전엔 외래 템플릿 화면 안에 있어서 찾기 번거로웠음)
export default async function OtpPage() {
  const { userId } = await verifySession();
  const activeDevices = await prisma.deviceSession.count({ where: { createdById: userId, expiresAt: { gt: new Date() } } });

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">OTP 받기</h1>
      <OtpCard activeCount={activeDevices} endAll={endAllDeviceSessions} />
    </div>
  );
}
