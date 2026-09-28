import "server-only";
import {
  TypeSafeClient,
  type EntryType,
  type Questions,
  type SystemOneResult,
} from "@typesafe-ai/sdk";

export { choice, noul, score } from "@typesafe-ai/sdk";

let client: TypeSafeClient | null | undefined;

function getClient(): TypeSafeClient | null {
  if (client !== undefined) return client;
  try {
    client = new TypeSafeClient();
  } catch {
    client = null; // TYPESAFE_API_KEY 미설정 등 — 이후 모든 호출은 조용히 스킵
  }
  return client;
}

function logCall(info: { ok: boolean; questions: number; tokens: number; ms: number }) {
  console.log(`[jev] ok=${info.ok} questions=${info.questions} tokens=${info.tokens} ms=${info.ms}`);
}

/**
 * Jev(TypeSafe) 호출 공용 창구 — 프로젝트의 모든 Jev 호출은 이 함수 하나를 거친다.
 * 실패(키 미설정·네트워크 오류·타임아웃·4xx/5xx 등) 시 예외를 던지지 않고 null을 반환한다.
 * 호출부는 null을 받으면 항상 기존(Jev 없이 하던) 동작을 그대로 이어서 실행해야 한다.
 * 로그에는 건수·토큰·소요시간만 남기고, state·질문·답변 원문은 남기지 않는다
 * (여기로 넘어오는 건 수술기록지 본문이라 특히 원문을 남기면 안 된다).
 */
export async function askJev<Q extends Questions>(
  state: EntryType,
  questions: Q,
  timeoutMs = 6000,
): Promise<SystemOneResult<Q>["answers"] | null> {
  const c = getClient();
  if (!c) return null;

  const startedAt = Date.now();
  const questionCount = Object.keys(questions).length;
  try {
    // SDK 타입은 state: null을 허용하지만 실제 API는 422로 거부한다 — 여기서 방어.
    const result = await c.systemOne({ state: state ?? {}, questions }, { timeout: timeoutMs });
    logCall({
      ok: true,
      questions: questionCount,
      tokens: result.usage.input_tokens + result.usage.output_tokens,
      ms: Date.now() - startedAt,
    });
    return result.answers;
  } catch {
    logCall({ ok: false, questions: questionCount, tokens: 0, ms: Date.now() - startedAt });
    return null;
  }
}
