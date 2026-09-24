import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const verifySession = cache(async () => {
  const session = await getSessionPayload();
  if (!session?.userId) {
    redirect("/login");
  }
  return { isAuth: true, userId: session.userId as string };
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();
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
    },
  });
  if (!user) {
    redirect("/login");
  }
  return user;
});
