import { pcJson, pcNotFound } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { ErVisitBodySchema } from "@/lib/er-visits";
import { getErRequest, saveErVisits } from "@/lib/er-visits-store";

// 병원 PC(er_sync.ps1) 입구 — 인증은 schedule-import와 같은 토큰.
// GET: "응급실 환자 가져오기" 요청(날짜·동반당직자)과 저장할 온콜대장 신청. POST: 그날 내가 본 응급실 환자 목록
export async function GET(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();
  return pcJson(await getErRequest(user.id));
}

export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();

  const parsed = ErVisitBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return pcJson(await saveErVisits(user.id, parsed.data));
}
