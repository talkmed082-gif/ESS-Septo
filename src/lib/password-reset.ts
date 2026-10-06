import { createHash, randomBytes } from "node:crypto";

// 비밀번호 재설정 링크의 유효 시간
export const RESET_TOKEN_MINUTES = 30;
// 같은 계정으로 재설정 메일을 너무 자주 보내지 않게 하는 간격
export const RESET_REQUEST_COOLDOWN_SECONDS = 60;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 메일 링크에 넣을 원문 토큰과, DB에 저장할 해시를 함께 만든다 — DB가 새더라도
// 해시만으로는 링크를 만들 수 없다.
export function createResetToken(now: Date = new Date()): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashResetToken(token),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_MINUTES * 60000),
  };
}

// 직전에 만든 토큰이 아직 쿨다운 안에 있으면 새로 보내지 않는다(만료 시각에서 거꾸로 계산).
export function inResetCooldown(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const issuedAt = expiresAt.getTime() - RESET_TOKEN_MINUTES * 60000;
  return now.getTime() - issuedAt < RESET_REQUEST_COOLDOWN_SECONDS * 1000;
}

// 메일 링크의 주소 — 요청의 Host 헤더를 그대로 믿으면 남의 주소로 링크를 보내게
// 조작될 수 있어서(재설정 링크 가로채기), 설정한 주소를 먼저 쓴다.
export function appBaseUrl(env: Record<string, string | undefined>, requestOrigin: string | null): string | null {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  // 로컬 개발 등 설정이 없을 때만 요청 주소를 쓴다.
  return env.NODE_ENV === "production" ? null : requestOrigin;
}
