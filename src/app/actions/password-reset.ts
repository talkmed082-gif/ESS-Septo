"use server";

import bcrypt from "bcryptjs";
import * as z from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { normalizeEmail } from "@/lib/login-lock";
import {
  RESET_TOKEN_MINUTES,
  appBaseUrl,
  createResetToken,
  hashResetToken,
  inResetCooldown,
} from "@/lib/password-reset";

export interface PasswordResetFormState {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
}

// 가입 여부를 알려주지 않으려고, 계정이 있든 없든 같은 안내를 돌려준다.
const SENT_MESSAGE =
  "가입된 이메일이면 비밀번호 재설정 링크를 보냈습니다. 메일이 안 보이면 스팸함을 확인해 주세요.";

export async function requestPasswordReset(
  _prevState: PasswordResetFormState | undefined,
  formData: FormData,
): Promise<PasswordResetFormState> {
  const parsed = z.email({ error: "올바른 이메일을 입력하세요." }).safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { errors: { email: [parsed.error.issues[0].message] } };

  if (!isMailConfigured()) {
    return { message: "메일 발송이 아직 설정되지 않았습니다. 관리자에게 비밀번호 초기화를 요청해 주세요." };
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : null;
  const baseUrl = appBaseUrl(process.env, origin);
  if (!baseUrl) {
    return { message: "앱 주소(APP_URL)가 설정되지 않아 메일을 보낼 수 없습니다. 관리자에게 문의해 주세요." };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(parsed.data), mode: "insensitive" } },
  });
  if (!user || inResetCooldown(user.resetTokenExpiresAt)) return { ok: true, message: SENT_MESSAGE };

  const { token, hash, expiresAt } = createResetToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash: hash, resetTokenExpiresAt: expiresAt },
  });
  await sendMail({
    to: user.email,
    subject: "[Op Plan] 비밀번호 재설정",
    text: [
      `${user.name}님, 비밀번호 재설정을 요청하셨습니다.`,
      "",
      `아래 링크에서 ${RESET_TOKEN_MINUTES}분 안에 새 비밀번호를 정해 주세요.`,
      `${baseUrl}/reset-password?token=${token}`,
      "",
      "요청하지 않으셨다면 이 메일은 무시하셔도 됩니다. 비밀번호는 바뀌지 않습니다.",
    ].join("\n"),
  });
  return { ok: true, message: SENT_MESSAGE };
}

const ResetSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(8, { error: "새 비밀번호는 8자 이상이어야 합니다." }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    error: "새 비밀번호가 서로 다릅니다.",
    path: ["confirmPassword"],
  });

// 링크의 토큰이 맞고 만료 전이면 비밀번호를 바꾸고, 토큰은 지워서 한 번만 쓰게
// 한다. 세션 버전도 올려서 혹시 남아 있던 다른 기기 로그인을 끊는다.
export async function resetPassword(
  _prevState: PasswordResetFormState | undefined,
  formData: FormData,
): Promise<PasswordResetFormState> {
  const validated = ResetSchema.safeParse({
    token: formData.get("token") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!validated.success) return { errors: z.flattenError(validated.error).fieldErrors };

  const user = await prisma.user.findFirst({
    where: { resetTokenHash: hashResetToken(validated.data.token), resetTokenExpiresAt: { gt: new Date() } },
  });
  if (!user) {
    return { message: "링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 해 주세요." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(validated.data.newPassword, 10),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  return { ok: true, message: "비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요." };
}
