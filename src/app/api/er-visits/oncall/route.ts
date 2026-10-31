import { pcJson, pcNotFound } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { ErOncallResultSchema } from "@/lib/er-visits";
import { recordErOncall } from "@/lib/er-visits-store";

// 병원 PC가 부서행정 온콜대장에 저장한 결과
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();

  const parsed = ErOncallResultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return pcJson(await recordErOncall(user.id, parsed.data));
}
