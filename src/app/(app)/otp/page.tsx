import { redirect } from "next/navigation";

// 예전 첫 화면(OTP 받기) — 홈 화면 앱·즐겨찾기 주소라 남겨 두고 대시보드로 넘긴다(2026-10-25)
export default function OtpPage() {
  redirect("/dashboard");
}
