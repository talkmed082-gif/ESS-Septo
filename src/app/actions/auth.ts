"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { isEmailAllowed } from "@/lib/signup-policy";
import { lockedMinutesLeft, normalizeEmail, stateAfterFailure } from "@/lib/login-lock";
import { verifySession } from "@/lib/dal";

// 이메일은 대소문자를 구분하지 않는다 — 예전엔 가입할 때 적은 그대로 저장해서
// "User@..."로 가입하고 "user@..."로 로그인하면 실패했다. 새로 저장할 땐 소문자로
// 맞추고, 찾을 땐 기존에 대문자로 저장된 계정도 찾히도록 대소문자 무시로 찾는다.
function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
}

const SignupSchema = z.object({
  name: z.string().trim().min(1, { error: "이름을 입력하세요." }),
  email: z.email({ error: "올바른 이메일을 입력하세요." }).trim(),
  password: z
    .string()
    .min(8, { error: "비밀번호는 8자 이상이어야 합니다." }),
});

export interface AuthFormState {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string;
}

export async function signup(
  _prevState: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { name, password } = validated.data;
  const email = normalizeEmail(validated.data.email);

  if (!isEmailAllowed(email, process.env.ALLOWED_EMAILS)) {
    return { errors: { email: ["가입이 허용되지 않은 이메일입니다."] } };
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return { errors: { email: ["이미 사용 중인 이메일입니다."] } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  await createSession(user.id, user.sessionVersion);
  redirect("/");
}

const LoginSchema = z.object({
  email: z.email({ error: "올바른 이메일을 입력하세요." }).trim(),
  password: z.string().min(1, { error: "비밀번호를 입력하세요." }),
});

export async function login(
  _prevState: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const { password } = validated.data;
  const user = await findUserByEmail(normalizeEmail(validated.data.email));
  if (!user) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const minutesLeft = lockedMinutesLeft(user);
  if (minutesLeft > 0) {
    return { message: `로그인을 여러 번 실패해 잠시 잠겼습니다. ${minutesLeft}분 후 다시 시도하세요.` };
  }

  const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordsMatch) {
    const next = stateAfterFailure(user);
    await prisma.user.update({ where: { id: user.id }, data: next });
    if (next.lockedUntil) {
      return { message: `로그인을 여러 번 실패해 ${lockedMinutesLeft(next)}분 동안 잠겼습니다.` };
    }
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }
  await createSession(user.id, user.sessionVersion);
  redirect("/");
}

const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "현재 비밀번호를 입력하세요." }),
    newPassword: z.string().min(8, { error: "새 비밀번호는 8자 이상이어야 합니다." }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    error: "새 비밀번호가 서로 다릅니다.",
    path: ["confirmPassword"],
  });

export interface AccountFormState {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
}

// 비밀번호를 바꾸면 세션 버전을 올려서 다른 기기의 로그인은 모두 끊고, 지금
// 기기만 새 버전으로 다시 로그인시켜 둔다.
export async function changePassword(
  _prevState: AccountFormState | undefined,
  formData: FormData,
): Promise<AccountFormState> {
  const { userId } = await verifySession();
  const validated = PasswordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { message: "계정을 찾을 수 없습니다." };
  if (!(await bcrypt.compare(validated.data.currentPassword, user.passwordHash))) {
    return { errors: { currentPassword: ["현재 비밀번호가 올바르지 않습니다."] } };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(validated.data.newPassword, 10),
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await createSession(userId, updated.sessionVersion);
  return { ok: true, message: "비밀번호를 바꿨습니다. 다른 기기의 로그인은 모두 끊겼습니다." };
}

// 폰 분실 등에 대비해, 지금 쓰는 기기만 남기고 다른 기기의 로그인을 모두 끊는다.
export async function logoutOtherDevices(): Promise<AccountFormState> {
  const { userId } = await verifySession();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
  await createSession(userId, updated.sessionVersion);
  return { ok: true, message: "다른 기기의 로그인을 모두 끊었습니다." };
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
