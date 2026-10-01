/**
 * Campaign presets.
 *
 * Nearly every campaign on this account is the same campaign with a different
 * brand in it: the keywords, the ten public replies and the DM text are fixed,
 * and only the brand word, the post and the link change. Typing all of that
 * through the generic four-step wizard once per product is what this replaces.
 *
 * The texts live here rather than in the database so they can be reviewed and
 * changed in a commit. Editing one changes future campaigns only — existing
 * ones keep whatever they were created with.
 */

/** Written into every template where the brand word belongs. */
const BRAND = "{бренд}";

export type PresetId = "product" | "service";

/**
 * Always present, in this order, with the brand word appended. Whole-word
 * matching is on, so "цена" does not fire on "по цене" — that is deliberate
 * and matches how these campaigns have always been set up.
 */
const PRODUCT_KEYWORDS = [
  "цена",
  "цену",
  "ссылка",
  "ссылку",
  "как купить",
  "сколько",
  "стоит",
];

/**
 * Ten phrasings of the same public reply. The worker picks one at random per
 * comment, so a post with many comments does not show a column of identical
 * answers, which reads as a bot and invites a report.
 */
const PRODUCT_REPLIES = [
  `Добрый день! Направили Вам ссылку в директ. Актуальные цены можно посмотреть на нашем сайте zetzet.ru, указав в поиске «${BRAND}».`,
  `Здравствуйте! Ссылку отправили Вам в директ. Свежие цены всегда доступны на zetzet.ru — просто введите в поисковую строку «${BRAND}».`,
  `Добрый день! Уже отправили ссылку Вам в директ. Актуальную стоимость можно проверить на сайте zetzet.ru по запросу «${BRAND}».`,
  `Здравствуйте! Ссылка уже у Вас в директе. Все актуальные цены размещены на нашем сайте zetzet.ru, для поиска введите «${BRAND}».`,
  `Добрый день! Ссылку направили в личные сообщения. Актуальные цены Вы всегда можете найти на zetzet.ru, введя в поиске «${BRAND}».`,
  `Здравствуйте! Отправили Вам ссылку в директ. Посмотреть действующие цены можно на сайте zetzet.ru через поиск по слову «${BRAND}».`,
  `Добрый день! Ссылка отправлена Вам в директ. Актуальную информацию по ценам можно найти на zetzet.ru, если ввести в поиске «${BRAND}».`,
  `Здравствуйте! Направили ссылку в директ. Все актуальные цены доступны на нашем сайте zetzet.ru — воспользуйтесь поиском по запросу «${BRAND}».`,
  `Добрый день! Ссылку уже отправили Вам в личные сообщения. Цены всегда можно уточнить на zetzet.ru, введя в поисковую строку «${BRAND}».`,
  `Здравствуйте! Отправили ссылку Вам в директ. Актуальные цены смотрите на нашем сайте zetzet.ru по поисковому запросу «${BRAND}».`,
];

/** The brand word goes in last, after the fixed intent words. */
export function productKeywords(brand: string): string[] {
  return [...PRODUCT_KEYWORDS, brand.trim().toLowerCase()];
}

export function productReplies(brand: string): string[] {
  const word = brand.trim();
  return PRODUCT_REPLIES.map((reply) => reply.split(BRAND).join(word));
}

/**
 * The DM agrees with the number of buttons: one link is "ссылку", two are
 * "ссылки". `{link}` is only rendered when the buttons are suppressed, so the
 * sentence has to read correctly either way.
 */
export function productDm(linkCount: number): string {
  const noun = linkCount > 1 ? "ссылки" : "ссылку";
  return `Добрый день, {username}!\nКак и обещали, прикладываем ${noun}: {link}`;
}

// --- Услуга: полиуретан ---------------------------------------------------

/**
 * The service campaign has no variable part at all — one service, one form,
 * the same wording every time. Picking the post is the whole dialogue.
 */
const SERVICE_KEYWORDS = [
  "броня",
  "пленка",
  // The same word spelled with ё, which needs its own entry: the matcher
  // deliberately keeps Cyrillic combining marks (folding them would turn "й"
  // into "и"), so "плёнка" — the spelling most people actually use — does not
  // match a "пленка" keyword.
  "плёнка",
  "цена",
  "цену",
  "ссылку",
  // A phrase matches only as that exact pair of words: "сколько это стоит"
  // does not fire. Kept as given; splitting it would also fire on any other
  // "стоит" ("стоит ли брать"), which is not the same question.
  "сколько стоит",
  "как купить",
  "полиуретан",
];

/** Ten phrasings, same reason as the product ones: a column of identical public replies reads as a bot. */
const SERVICE_REPLIES = [
  "Добрый день! Направили Вам ссылку в директ.",
  "Здравствуйте! Ссылку отправили Вам в директ.",
  "Добрый день! Уже отправили ссылку Вам в директ.",
  "Здравствуйте! Ссылка уже у Вас в директе.",
  "Добрый день! Ссылку направили в личные сообщения.",
  "Здравствуйте! Отправили Вам ссылку в директ.",
  "Добрый день! Ссылка отправлена Вам в директ.",
  "Здравствуйте! Направили ссылку в директ.",
  "Добрый день! Ссылку уже отправили Вам в личные сообщения.",
  "Здравствуйте! Отправили ссылку Вам в директ.",
];

/** The lead form every полиуретан campaign points at. */
const SERVICE_LINK = {
  url: "https://forms.yandex.ru/cloud/6926fbca84227ca4ce3b4a69/",
  label: "Оставить заявку",
};

const SERVICE_DM = "Добрый день! Как и обещали, прикладываем ссылку: {link}";

// Fresh arrays and a fresh object each time: the session mutates what it is
// handed — the edit flow replaces links in place — and a shared constant would
// carry that edit into the next campaign built from this preset.
export function serviceKeywords(): string[] {
  return [...SERVICE_KEYWORDS];
}

export function serviceReplies(): string[] {
  return [...SERVICE_REPLIES];
}

export function serviceLinks(): { url: string; label: string }[] {
  return [{ ...SERVICE_LINK }];
}

export function serviceDm(): string {
  return SERVICE_DM;
}

export const PRESET_LABELS: Record<PresetId, string> = {
  product: "📦 Товар",
  service: "🛠 Услуга",
};
