import { redirect } from "next/navigation";

// 일정 알림은 캘린더 아래로 합쳤다(사용자 2026-10-27) — 예전 주소는 캘린더의 일정 알림 칸으로
export default function RemindersPage() {
  redirect("/calendar#reminders");
}
