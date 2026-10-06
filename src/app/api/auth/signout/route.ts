import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// 끊긴 세션(비밀번호 변경 후 다른 기기, 삭제된 계정 등)의 쿠키를 지우고 로그인
// 화면으로 보낸다 — /api 경로라 proxy의 로그인 검사를 거치지 않는다.
export function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", req.nextUrl));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
