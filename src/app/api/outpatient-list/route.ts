import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { OutpatientListBodySchema } from "@/lib/hospital-link";
import { saveOutpatientList } from "@/lib/hospital-link-store";

// 병원 PC가 다음 날 외래 명단을 올리는 입구(텔레그램과 같은 내용). 같은 날짜는 덮어쓴다.
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const parsed = OutpatientListBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return pcJson(await saveOutpatientList(user.id, parsed.data));
}
