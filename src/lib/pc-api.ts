import { NextResponse } from "next/server";

// 병원 PC(Windows PowerShell 5.1)가 부르는 API의 JSON 응답. charset이 없으면 PS 5.1이 한글을
// ISO-8859-1로 읽어 깨뜨려서(2026-10-14 깨진 리마인더가 EMR에 들어감) 항상 utf-8을 밝힌다.
export function pcJson(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function pcNotFound() {
  return new NextResponse("Not found", { status: 404 });
}
