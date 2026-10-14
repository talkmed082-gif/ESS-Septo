import { findUserByImportToken } from "@/lib/import-auth";
import { PcJobBodySchema } from "@/lib/hospital-link";
import { recordPcJob } from "@/lib/hospital-link-store";
import { pcJson, pcNotFound } from "@/lib/pc-api";

// 병원 PC 작업(수술 일정·리마인더·외래 명단·TSA·설정 파일 점검)이 끝날 때마다 성공/실패를 올리는 입구.
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return pcNotFound();

  const parsed = PcJobBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return pcJson(await recordPcJob(user.id, parsed.data));
}
