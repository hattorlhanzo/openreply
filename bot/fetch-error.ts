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
/**
 * Pull the most specific code out of a cause chain.
 *
 * With Happy Eyeballs, Node tries IPv6 and IPv4 at once and, when both fail,
 * reports an AggregateError whose own `code` is undefined — so reading
 * `cause.code` alone yields nothing and the caller prints Node's bare "fetch
 * failed", which is the thing this module exists to prevent.
 */
function causeCode(error: unknown, depth = 0): string | undefined {
  if (depth > 4 || typeof error !== "object" || error === null) return undefined;

  const candidate = error as {
    code?: string;
    cause?: unknown;
    errors?: unknown[];
  };
  if (typeof candidate.code === "string") return candidate.code;

  for (const nested of candidate.errors ?? []) {
    const found = causeCode(nested, depth + 1);
    if (found) return found;
  }
  return causeCode(candidate.cause, depth + 1);
}

export function describeFetchError(error: unknown, timeoutMs?: number): string {
  if (!(error instanceof Error)) return String(error);
  const code = causeCode(error.cause) ?? causeCode(error);

  if (error.name === "TimeoutError" || code === "UND_ERR_HEADERS_TIMEOUT") {
    return timeoutMs ? `нет ответа за ${timeoutMs / 1000} с` : "нет ответа (таймаут)";
  }
  if (code === "UND_ERR_CONNECT_TIMEOUT") return "не удалось соединиться (таймаут)";
  if (code === "UND_ERR_SOCKET") return "соединение оборвалось";
  if (code === "ECONNREFUSED") return "соединение отклонено (порт закрыт)";
  if (code === "ENETUNREACH") return "сеть недоступна (нет маршрута)";
  if (code === "ETIMEDOUT") return "соединение не установилось (таймаут сети)";
  if (code === "EAI_AGAIN") return "имя не разрешается (DNS)";

  if (code) return `${error.message} (${code})`;

  // Still nothing: surface whatever the cause says rather than repeating the
  // two words that started this.
  const causeMessage =
    error.cause instanceof Error ? error.cause.message : undefined;
  return causeMessage ? `${error.message}: ${causeMessage}` : error.message;
}
