import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// 쿠키를 지우고 로그인 화면으로 보내는 경로 — 화면 렌더링 중에는 쿠키를 지울 수
// 없어서, 끊긴 세션을 그냥 /login으로 보내면 proxy가 (서명은 유효한) 쿠키를 보고
// 다시 첫 화면으로 돌려보내 둘 사이를 계속 오간다.
const SIGN_OUT_PATH = "/api/auth/signout";

// 로그인 확인과 현재 사용자 조회를 한 번의 조회로 처리한다(요청마다 cache).
// 비밀번호 변경·"다른 기기 로그아웃"으로 세션 버전이 올라갔으면 예전 쿠키는 끊는다.
export const verifySession = cache(async () => {
  const session = await getSessionPayload();
  if (!session?.userId) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      sideNotation: true,
      abbreviateRegions: true,
      defaultAssistantName: true,
      calendarToken: true,
      sessionVersion: true,
    },
  });
  if (!user || (session.sv ?? 0) !== user.sessionVersion) {
    redirect(SIGN_OUT_PATH);
  }
  return { isAuth: true, userId: user.id, user };
});

export const getCurrentUser = cache(async () => (await verifySession()).user);
