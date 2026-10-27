import "server-only";
import { prisma } from "@/lib/prisma";

// OSA 시트 웹앱(outpatient-list\osa_sheet_app.gs, 사용자 구글 계정에서 돎) 부르기 — 시트 열 이름·줄 추가·Gmail 검색.
// 주소·키는 설정에서 넣는다. 못 부르면 { error } (화면에 그대로 보여 줌)
export async function callOsaScript(userId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { osaScriptUrl: true, osaScriptKey: true } });
  if (!u?.osaScriptUrl || !u.osaScriptKey) return { error: "OSA 시트가 연결되지 않았습니다(설정 → OSA 시트 연결)." };
  try {
    const r = await fetch(u.osaScriptUrl, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ ...body, key: u.osaScriptKey }), redirect: "follow", signal: AbortSignal.timeout(25_000) });
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!j) return { error: `OSA 시트 응답을 읽지 못했습니다(${r.status}).` };
    if (j.error === "key") return { error: "OSA 시트 키가 다릅니다(스크립트의 KEY와 설정의 키를 같게)." };
    return j;
  } catch {
    return { error: "OSA 시트에 연결하지 못했습니다(주소 확인)." };
  }
}
