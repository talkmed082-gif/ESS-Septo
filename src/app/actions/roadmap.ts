"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { toggleRoadmapTodo } from "@/lib/roadmap-store";

// 로드맵 할 일(□) 체크/해제 — 본인 것만
export async function toggleTodo(versionId: string, item: string): Promise<void> {
  const session = await verifySession();
  await toggleRoadmapTodo(session.userId, versionId, item);
  revalidatePath("/outpatient");
  revalidatePath("/dashboard");
  revalidatePath("/clinic");
}
