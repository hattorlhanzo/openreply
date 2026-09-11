/**
 * Общие русские строки кабинета: навигация, статусы, ошибки API.
 * Экранные тексты живут прямо в компонентах; сюда попадает только то, что
 * используется больше чем в одном месте.
 */

export const BRAND = "СМАРТУЧЕТ";
export const PRODUCT = "Instagram-автоматизация";

export const NAV = {
  dashboard: "Сводка",
  overview: "Аккаунт",
  inbox: "Входящие",
  campaigns: "Кампании",
  logs: "Журнал отправок",
  settings: "Настройки",
  diagnostics: "Диагностика",
} as const;

/** Подписи статусов DmLog. Ключи — enum DmStatus в Prisma, их не переводим. */
export const DM_STATUS_LABEL: Record<string, string> = {
  SENT: "Отправлено",
  FAILED: "Ошибка",
  PENDING: "В очереди",
  SKIPPED_DEDUP: "Повтор",
  SKIPPED_RATE_LIMIT: "Лимит Meta",
  SKIPPED_PLAN_LIMIT: "Пропущено",
  SKIPPED_NO_MATCH: "Нет совпадения",
};

export const WORKSPACE_ROLE_LABEL: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Сотрудник",
};

/** Ошибки API, которые показываются пользователю как есть. */
export const API_ERRORS = {
  unauthorized: "Нужно войти в систему",
  forbidden: "Недостаточно прав",
  notFound: "Не найдено",
  invalidData: "Некорректные данные",
  ownersAndAdminsOnly: "Действие доступно только владельцу и администратору",
  instagramNotConnected: "Instagram-аккаунт не подключён",
  serverError: "Внутренняя ошибка сервера",
  // --- добавлено при переводе API-маршрутов (только новые ключи) ---
  ownersAndAdminsOnlyInvite: "Приглашать участников может только владелец или администратор",
  ownersAndAdminsOnlyRoles: "Менять роли может только владелец или администратор",
  ownersAndAdminsOnlyRemove: "Удалять участников может только владелец или администратор",
  ownersAndAdminsOnlyCampaigns: "Управлять кампаниями может только владелец или администратор",
  ownersAndAdminsOnlyImport: "Импортировать кампании может только владелец или администратор",
  ownersAndAdminsOnlyDisconnect: "Отключать аккаунты может только владелец или администратор",
  invalidInvitation: "Некорректное приглашение",
  invalidMemberUpdate: "Некорректные данные участника",
  memberCannotBeUpdated: "Этого участника нельзя изменить",
  memberCannotBeRemoved: "Этого участника нельзя удалить",
  missingMemberOrInvitationId: "Не указан участник или приглашение",
  signInWithInvitedEmail: "Сначала войдите с email, на который пришло приглашение",
  missingInvitationToken: "Не указан токен приглашения",
  invitationUnavailable: "Приглашение больше недоступно",
  invitationExpired: "Срок действия приглашения истёк",
  invitationForDifferentEmail: "Это приглашение выдано на другой email",
  invalidInput: "Некорректные данные формы",
  invalidRequestBody: "Некорректный запрос",
  invalidImportData: "Некорректные данные импорта",
  workspaceNotFound: "Рабочее пространство не найдено",
  campaignNotFound: "Кампания не найдена",
  missingCampaignId: "Не указан идентификатор кампании",
  connectInstagramFirst: "Сначала подключите Instagram-аккаунт",
  instagramAccountNotFound: "Instagram-аккаунт не найден",
  recipientAndMessageRequired: "Укажите получателя и текст сообщения",
  failedToFetchPosts: "Не удалось загрузить публикации Instagram",
  failedToLoadProfile: "Не удалось загрузить профиль",
  failedToLoadOverview: "Не удалось загрузить сводку Instagram",
  failedToLoadConversations: "Не удалось загрузить диалоги",
  failedToLoadMessages: "Не удалось загрузить сообщения",
  failedToSendMessage: "Не удалось отправить сообщение",
  campaignNeedsPost: "Выберите публикацию, которая запускает кампанию",
  campaignNeedsKeyword: "Добавьте хотя бы одно ключевое слово или включите «любое слово»",
  openingDmNeedsMessageAndButton: "Для вступительного сообщения нужны текст и подпись кнопки",
} as const;

/** Дата и время в формате RU, без секунд. */
export function formatDateTimeRu(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Дата без времени в формате RU: 11.09.2026. */
export function formatDateRu(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Склонение: pluralRu(3, ["кампания", "кампании", "кампаний"]). */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** Короткая дата «12 мая» (год не показываем — контекст всегда недавний). */
export function formatDayRu(value: string | Date, timeZone?: string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    ...(timeZone ? { timeZone } : {}),
  });
}

/** Число с русскими разделителями разрядов: 12 345. */
export function formatNumberRu(n: number): string {
  return n.toLocaleString("ru-RU");
}

/** Компактное число для осей и плиток: 1,2 тыс. / 3,4 млн. */
export function formatCompactRu(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`;
  if (abs >= 1_000) return `${(n / 1_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} тыс.`;
  return formatNumberRu(n);
}

/** Число со знаком: +12 / −3 (минус типографский). */
export function formatSignedRu(n: number): string {
  if (n > 0) return `+${formatNumberRu(n)}`;
  if (n < 0) return `−${formatNumberRu(Math.abs(n))}`;
  return "0";
}
