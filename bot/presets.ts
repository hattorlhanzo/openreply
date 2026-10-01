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

export type PresetId = "product";

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

export const PRESET_LABELS: Record<PresetId, string> = {
  product: "📦 Товар",
};
