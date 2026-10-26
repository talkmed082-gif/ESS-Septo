import { pcJson, pcNotFound } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { ConsultReplyResultSchema } from "@/lib/hospital-link";
import { recordConsultReply } from "@/lib/hospital-link-store";

// 병원 PC가 회신을 EMR 회신 기록지에 넣고 [저장]·일괄서명한 결과(서명만 다시 한 결과도 여기로).
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();

  const parsed = ConsultReplyResultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return pcJson(await recordConsultReply(user.id, parsed.data));
}
