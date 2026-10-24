import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { pcJson } from "@/lib/pc-api";
import { findUserForProgram } from "@/lib/device-auth";

// 외래 도우미 자동 업데이트 — 프로그램이 켜질 때 ?check로 지금 올라간 파일의 SHA-256을 받아 자기 파일과 비교하고,
// 다르면 ?download로 받아 바꾼다. 연결 코드 세션(진료실 PC)만.
export async function GET(request: Request) {
  const user = await findUserForProgram(request);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const file = await readFile(path.join(process.cwd(), "downloads", "OpdHelper.exe"));
  if (new URL(request.url).searchParams.has("download"))
    return new Response(new Uint8Array(file), {
      headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store" },
    });
  return pcJson({ sha256: createHash("sha256").update(file).digest("hex"), size: file.length });
}
