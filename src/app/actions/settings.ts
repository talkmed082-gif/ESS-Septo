"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

const SettingsSchema = z.object({
  sideNotation: z.enum(["full", "paren", "bracket"]),
  abbreviateRegions: z.enum(["true", "false"]),
});

export interface SettingsFormState {
  message?: string;
}

export async function updateNameStyleSettings(
  _prevState: SettingsFormState | undefined,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await verifySession();

  const validated = SettingsSchema.safeParse({
    sideNotation: formData.get("sideNotation"),
    abbreviateRegions: formData.get("abbreviateRegions"),
  });
  if (!validated.success) {
    return { message: "입력값을 확인하세요." };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      sideNotation: validated.data.sideNotation,
      abbreviateRegions: validated.data.abbreviateRegions === "true",
    },
  });

  revalidatePath("/settings");
  return { message: "저장되었습니다." };
}
