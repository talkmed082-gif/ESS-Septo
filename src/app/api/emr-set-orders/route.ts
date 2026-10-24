import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { EmrSetOrderBodySchema } from "@/lib/outpatient-templates";
import { replaceEmrSetOrders } from "@/lib/outpatient-templates-store";

// 진료실 PC 프로그램이 지금 YES에 로그인한 사람(사번)의 약속처방 트리를 올리는 입구.
// 다른 사람이 자기 아이디로 로그인한 PC에서 올리면 그 사람 세트가 내 계정에 따로 쌓인다.
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const parsed = EmrSetOrderBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  return pcJson(await replaceEmrSetOrders(user.id, parsed.data));
}
