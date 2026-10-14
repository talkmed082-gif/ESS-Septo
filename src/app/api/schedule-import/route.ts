import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import * as z from "zod";
import { findUserByImportToken } from "@/lib/import-auth";
import { importScheduleRows, ScheduleRowSchema } from "@/lib/schedule-import-store";

// 병원 PC 스크립트(EMR 수술장 화면 조회)가 내 집도 건을 올리는 입구 — 로그인 쿠키 대신
// Authorization: Bearer <importToken>이 인증이다(/api 경로는 proxy 로그인 검사 대상이 아니다).
// 토큰이 없거나 틀리면 어떤 정보도 알려주지 않도록 똑같이 404로 답한다.
const BodySchema = z.object({ rows: z.array(ScheduleRowSchema).max(200) });

export async function POST(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return notFound();

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "행 형식이 올바르지 않습니다." }, { status: 400 });

  const result = await importScheduleRows(user, parsed.data.rows);
  return pcJson(result);
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}
