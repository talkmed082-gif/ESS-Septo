import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/session";

// 첫 화면은 환자 목록이 바로 낫다 — 비로그인 미리보기(퀵 도구)는 없애고,
// 그 기능은 이미 로그인 후 "새 환자 등록"(SurgeryPlanner) 화면이 그대로
// 담당한다.
export default async function HomePage() {
  const session = await getSessionPayload();
  redirect(session?.userId ? "/patients" : "/login");
}
