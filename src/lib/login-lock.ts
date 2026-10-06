// 로그인 실패가 이 횟수만큼 이어지면 계정을 잠시 잠근다 — 비밀번호를 계속 대입해
// 보는 것을 막기 위함. 서버리스라 메모리 대신 User 행에 횟수/잠금 시각을 둔다.
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export interface LoginLockState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

// 잠겨 있으면 남은 분(올림)을, 아니면 0을 돌려준다.
export function lockedMinutesLeft(state: LoginLockState, now: Date = new Date()): number {
  if (!state.lockedUntil || state.lockedUntil <= now) return 0;
  return Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 60000);
}

// 비밀번호가 틀렸을 때 저장할 다음 상태 — 한도에 닿으면 잠그고 횟수는 다시 0부터.
export function stateAfterFailure(state: LoginLockState, now: Date = new Date()): LoginLockState {
  // 잠금이 이미 풀린 뒤의 실패는 새로 세기 시작한다.
  const count = (state.lockedUntil && state.lockedUntil <= now ? 0 : state.failedLoginCount) + 1;
  if (count >= MAX_FAILED_LOGINS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000) };
  }
  return { failedLoginCount: count, lockedUntil: null };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
