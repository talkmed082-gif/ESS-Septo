import { pcJson, pcNotFound } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { ConsultBodySchema } from "@/lib/hospital-link";
import { getConsultRequest, saveConsults } from "@/lib/hospital-link-store";

// 병원 PC가 EMR 타과의뢰 목록을 올리는 입구(인증은 schedule-import와 같은 토큰).
// GET: "타과의뢰 가져오기" 요청 시각(없으면 requestedAt: null)과 EMR에 저장할 회신(replies). POST: 본인에게 온 타과의뢰 목록(기간 전체).
export async function GET(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();
  return pcJson(await getConsultRequest(user.id));
}

export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();

  const parsed = ConsultBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return pcJson(await saveConsults(user.id, parsed.data));
}
