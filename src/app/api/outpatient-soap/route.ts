import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { OutpatientSoapBodySchema } from "@/lib/hospital-link";
import { saveOutpatientSoap } from "@/lib/hospital-link-store";

// 병원 PC가 외래 명단 환자별 AI SOAP(참고용)를 올리는 입구. 같은 날짜 명단의 등록번호가 같은 행에 붙인다.
export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const parsed = OutpatientSoapBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });

  const result = await saveOutpatientSoap(user.id, parsed.data);
  if (!result) return pcJson({ error: "그 날짜 외래 명단이 없습니다." }, { status: 404 });
  return pcJson(result);
}
