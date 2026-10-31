import { pcJson, pcNotFound } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { ErNowBodySchema } from "@/lib/er-visits";
import { saveErNow } from "@/lib/er-visits-store";

// 병원 PC(er_now.ps1) 입구 — 응급실 현황(지금 응급실에 있는 환자) 목록. [새로고침] 요청은 GET /api/er-visits의 nowRequestedAt
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();

  const parsed = ErNowBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return pcJson(await saveErNow(user.id, parsed.data));
}
