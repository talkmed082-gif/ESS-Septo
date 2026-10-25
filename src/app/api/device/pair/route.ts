import * as z from "zod";
import { pcJson } from "@/lib/pc-api";
import { pairDevice } from "@/lib/device-auth";

// 진료실 PC 프로그램이 오늘의 번호(6자리)를 내고 세션 토큰을 받는 입구(로그인 없이 — 코드가 곧 확인)
export async function POST(request: Request) {
  const parsed = z.object({ code: z.string().max(10) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return pcJson({ error: "형식이 올바르지 않습니다." }, { status: 400 });
  const r = await pairDevice(parsed.data.code.trim());
  if (!r.ok) {
    return r.reason === "locked"
      ? pcJson({ error: "틀린 코드가 많아 잠시 막혔습니다. 10분 뒤 다시 해 주세요." }, { status: 429 })
      : pcJson({ error: "번호가 틀렸거나 바뀌었습니다. 사이트 맨 위 오늘의 번호를 넣어 주세요." }, { status: 401 });
  }
  return pcJson({ token: r.token, expiresAt: r.expiresAt.toISOString() });
}
