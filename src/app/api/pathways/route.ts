import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserByImportToken } from "@/lib/import-auth";
import { pathwayPromptList } from "@/lib/pathways";

// 노트북 SOAP·로드맵 작업이 AI 질문에 넣을 진료 경로 목록(경로 id = 단계 id들). 경로 정의는 사이트 한 곳에만 둔다
export async function GET(request: Request) {
  const user = await findUserByImportToken(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  return pcJson({ text: pathwayPromptList() });
}
