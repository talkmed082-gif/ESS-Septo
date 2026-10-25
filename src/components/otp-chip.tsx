import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { getDailyOtp } from "@/lib/device-auth";

// 상단 메뉴의 오늘의 번호 — 진료실 PC 프로그램을 켤 때 바로 보고 넣게(사용자 2026-10-25)
export async function OtpChip() {
  const { userId } = await verifySession();
  const { code } = await getDailyOtp(userId);
  return (
    <Link
      href="/dashboard#otp"
      title="오늘의 번호(진료실 PC 프로그램 연결, 서울 자정에 바뀜)"
      className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 font-mono text-sm font-semibold tracking-widest whitespace-nowrap text-emerald-800"
    >
      {code.slice(0, 3)} {code.slice(3)}
    </Link>
  );
}
