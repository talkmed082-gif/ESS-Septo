import { NextResponse } from "next/server";
import { findUserByImportToken } from "@/lib/import-auth";
import { TsaRunBodySchema } from "@/lib/hospital-link";
import { getTsaScanRequest, recordTsaRun } from "@/lib/hospital-link-store";

// 병원 PC가 TSA 구글 시트 작업과 이 사이트를 잇는 입구(인증은 schedule-import와 같은 토큰).
// GET: "TSA 기간 확인" 요청(없으면 request: null). POST: 시트에 넣은 결과(일일 실행·기간 확인).
export async function GET(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return notFound();
  return NextResponse.json({ request: await getTsaScanRequest(user.id) });
}

export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return notFound();

  const parsed = TsaRunBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  return NextResponse.json(await recordTsaRun(user.id, parsed.data));
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}
