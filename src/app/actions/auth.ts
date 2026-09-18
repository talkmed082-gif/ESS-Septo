"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

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

  const { name, email, password } = validated.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["이미 사용 중인 이메일입니다."] } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  await createSession(user.id);
  redirect("/patients");
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

  const { email, password } = validated.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordsMatch) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  await createSession(user.id);
  redirect("/patients");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
