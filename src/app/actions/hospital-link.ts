"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { validateTsaScanRange } from "@/lib/hospital-link";

export interface TsaScanFormState {
  message?: string;
  ok?: boolean;
}

// "TSA 기간 확인" 요청 — 병원 PC가 평일 근무 시간(08:00~20:00)에 10분마다 확인해서 처리한다.
// 다시 누르면 기간·요청 시각만 바뀐다.
export async function requestTsaScan(_prev: TsaScanFormState | undefined, formData: FormData): Promise<TsaScanFormState> {
  const session = await verifySession();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const error = validateTsaScanRange(from, to, new Date());
  if (error) return { message: error };
  await prisma.user.update({
    where: { id: session.userId },
    data: { tsaScanFrom: from, tsaScanTo: to, tsaScanRequestedAt: new Date() },
  });
  revalidatePath("/hospital");
  return { ok: true };
}

export async function cancelTsaScan(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({
    where: { id: session.userId },
    data: { tsaScanFrom: null, tsaScanTo: null, tsaScanRequestedAt: null },
  });
  revalidatePath("/hospital");
}
