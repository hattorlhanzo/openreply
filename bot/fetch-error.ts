/**
 * Node's fetch reports every transport failure as the single word "fetch
 * failed" and hides what actually happened in `cause`. Unwrap it, or a
 * timeout, a refused connection and an unreachable network all reach the
 * operator as the same useless sentence.
 *
 * This cost two weeks once: the bot logged "fetch failed" on every poll while
 * the host reached Telegram fine, and the message gave no way to tell a dead
 * socket from a blocked route.
 */
export function describeFetchError(error: unknown, timeoutMs?: number): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error.cause as { code?: string } | undefined)?.code;

  if (error.name === "TimeoutError" || code === "UND_ERR_HEADERS_TIMEOUT") {
    return timeoutMs ? `нет ответа за ${timeoutMs / 1000} с` : "нет ответа (таймаут)";
  }
  if (code === "ECONNREFUSED") return "соединение отклонено (порт закрыт)";
  if (code === "ENETUNREACH") return "сеть недоступна (нет маршрута)";
  if (code === "ETIMEDOUT") return "соединение не установилось (таймаут сети)";
  if (code === "EAI_AGAIN") return "имя не разрешается (DNS)";

  return code ? `${error.message} (${code})` : error.message;
}
