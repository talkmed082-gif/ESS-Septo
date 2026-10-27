import { verifySession } from "@/lib/dal";
import { getDailyOtp } from "@/lib/device-auth";
import { OtpLaunch } from "./otp-launch";

// 상단 메뉴의 오늘의 번호 — 진료실 PC 프로그램을 켤 때 바로 보고 넣게(사용자 2026-10-25). 누르면 프로그램을 켜고 이 번호로 연결(2026-10-27)
export async function OtpChip() {
  const { userId } = await verifySession();
  const { code } = await getDailyOtp(userId);
  return <OtpLaunch code={code} />;
}
