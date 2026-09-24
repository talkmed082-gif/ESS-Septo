import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  decrypt,
  encrypt,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  sessionCookieOptions,
} from "@/lib/session";

const publicRoutes = ["/login", "/signup", "/"];
const authOnlyRoutes = ["/login", "/signup"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await decrypt(cookie);

  if (!isPublicRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (authOnlyRoutes.includes(path) && session?.userId) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  const response = NextResponse.next();

  // 자동 로그인: 방문할 때마다 세션 만료 시간을 다시 늘려서, 계속 쓰는
  // 한 로그아웃되지 않게 한다(sliding session).
  if (session?.userId) {
    const refreshed = await encrypt({ userId: session.userId });
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    response.cookies.set(SESSION_COOKIE, refreshed, sessionCookieOptions(expiresAt));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|manifest\\.webmanifest|icon$|.*\\.png$).*)"],
};
