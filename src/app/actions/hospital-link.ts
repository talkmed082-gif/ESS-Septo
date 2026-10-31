"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { checkConsultReply, validateTsaScanRange } from "@/lib/hospital-link";

export interface TsaScanFormState {
  message?: string;
  ok?: boolean;
}

// "TSA 기간 확인" 요청 — 병원 PC가 매일 08:00~20:00(내 숙직 밤엔 밤새) 10분마다 확인해서 처리한다.
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
  revalidatePath("/surgery");
  return { ok: true };
}

// "타과의뢰 가져오기" 요청 — 병원 PC가 10분마다 확인해서 EMR 타과의뢰 목록을 올리고 요청을 비운다.
export async function requestConsultCheck(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({ where: { id: session.userId }, data: { consultCheckRequestedAt: new Date() } });
  revalidatePath("/consults");
}

export async function cancelConsultCheck(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({ where: { id: session.userId }, data: { consultCheckRequestedAt: null } });
  revalidatePath("/consults");
}

export interface ConsultReplyFormState {
  message?: string;
}

// 타과의뢰 회신 — 병원 PC가 10분 확인 때 EMR 회신 기록지에 넣고 [저장] → 일괄서명까지 한다.
// EMR에서 아직 회신 안 된(목록 9열 ≠ Y) 의뢰, 아직 EMR에 저장 안 된 회신만(저장된 뒤엔 EMR 칸에 글이 있어 다시 넣지 않음).
// 다시 보내면 글·요청 시각만 바뀐다
export async function requestConsultReply(
  _prev: ConsultReplyFormState | undefined,
  formData: FormData,
): Promise<ConsultReplyFormState> {
  const session = await verifySession();
  const id = String(formData.get("id") ?? "");
  const checked = checkConsultReply(String(formData.get("text") ?? ""));
  if ("error" in checked) return { message: checked.error };
  const r = await prisma.consult.updateMany({
    where: {
      id,
      createdById: session.userId,
      replied: false,
      OR: [{ replyStatus: null }, { replyStatus: { in: ["PENDING", "FAILED"] } }],
    },
    data: { replyText: checked.text, replyRequestedAt: new Date(), replyStatus: "PENDING", replyMessage: null },
  });
  if (r.count === 0) return { message: "이미 EMR에 회신이 저장된 의뢰입니다. 고치려면 EMR에서 직접 하세요." };
  revalidatePath("/consults");
  return {};
}

// 대기 중 요청만 취소(쓴 글은 남겨 둔다)
export async function cancelConsultReply(formData: FormData): Promise<void> {
  const session = await verifySession();
  await prisma.consult.updateMany({
    where: { id: String(formData.get("id") ?? ""), createdById: session.userId, replyStatus: "PENDING" },
    data: { replyStatus: null, replyRequestedAt: null },
  });
  revalidatePath("/consults");
}

export async function cancelTsaScan(): Promise<void> {
  const session = await verifySession();
  await prisma.user.update({
    where: { id: session.userId },
    data: { tsaScanFrom: null, tsaScanTo: null, tsaScanRequestedAt: null },
  });
  revalidatePath("/surgery");
}
