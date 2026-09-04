import { startMonitor, sendDigestNow } from "./monitor";

/**
 * Telegram bot for running campaigns without opening the dashboard.
 *
 *   /new   → pick a reel → keywords → public replies → links → DM text
 *   /list  → open a campaign → edit any field, pause, or delete
 *
 * Talks to the app over the compose network with BOT_API_KEY, so it needs no
 * browser session. Deliberately dependency-free: long polling over global fetch
 * keeps it runnable on the existing image with no extra install.
 *
 * Links always go in as *tracked* links, never inline in the message text.
 * Instagram does not linkify plain URLs in DMs — a raw address arrives as text
 * the recipient has to copy by hand, which is how a whole campaign can end up
 * with a 0% click rate.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER = process.env.TELEGRAM_ALLOWED_USER_ID;
const API_KEY = process.env.BOT_API_KEY;
const APP_URL = process.env.APP_INTERNAL_URL ?? "http://web:3000";
const PANEL_URL = process.env.NEXTAUTH_URL ?? "";
const DEFAULT_BUTTON = process.env.BOT_DEFAULT_BUTTON ?? "Открыть товар";

// Mirrors createAutomationSchema; kept here so the bot rejects input with a
// readable message instead of surfacing a raw zod error from the API.
const MAX_KEYWORDS = 10;
const MAX_KEYWORD_LEN = 50;
const MAX_REPLIES = 10;
const MAX_LINKS = 2;
const MAX_BUTTON_LEN = 20;
const MAX_MESSAGE_LEN = 1000;
const MAX_NAME_LEN = 100;

if (!TOKEN || !ALLOWED_USER || !API_KEY) {
  console.error(
    "[bot] нужны TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_ID и BOT_API_KEY"
  );
  process.exit(1);
}

const TG = `https://api.telegram.org/bot${TOKEN}`;
const SKIP = new Set(["-", "нет", "пропустить", "skip"]);

type Post = { id: string; caption?: string; permalink?: string };

type TrackedLink = { label: string; destinationUrl: string };

type Campaign = {
  id: string;
  name: string;
  isActive: boolean;
  postId: string | null;
  keywords: string[];
  dmMessage: string;
  publicReplyMessages: string[];
  linkButtonLabel: string | null;
  secondaryButtonLabel: string | null;
  trackedLinks: TrackedLink[];
  analytics: { sent: number; failed: number; clicks: number; ctr: number };
};

type CreateStep = "keywords" | "replies" | "links" | "message";
type EditField = "kw" | "rp" | "ln" | "msg" | "name";

type Link = { url: string; label: string };

type Session = {
  posts: Post[];
  post?: Post;
  step?: CreateStep;
  keywords: string[];
  replies: string[];
  links: Link[];
  campaigns: Campaign[];
  covered: Set<string>;
  page: number;
  showCovered: boolean;
  message?: string;
  editing?: { id: string; field: EditField };
};

// One operator, so in-memory state is enough. A restart drops an unfinished
// dialogue, which /new or /list starts over anyway.
const sessions = new Map<number, Session>();

const blank = (): Session => ({
  posts: [],
  keywords: [],
  replies: [],
  links: [],
  campaigns: [],
  covered: new Set(),
  page: 0,
  showCovered: false,
});

function session(chat: number): Session {
  let s = sessions.get(chat);
  if (!s) {
    s = blank();
    sessions.set(chat, s);
  }
  return s;
}

// --- Telegram -------------------------------------------------------------

async function tg(
  method: string,
  body: unknown,
  tolerant = false
): Promise<void> {
  const r = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { ok: boolean; description?: string };
  if (j.ok) return;

  // "message is not modified" just means the card already showed this state.
  if (j.description?.includes("not modified")) return;

  console.error(`[bot] ${method}: ${j.description}`);
  // Silent failures are the worst kind here: the operator sees nothing and
  // assumes the bot is dead. Raise so the update handler can say something.
  if (!tolerant) throw new Error(`${method}: ${j.description ?? "unknown"}`);
}

/** Last-resort notice: plain text, no markup, so it cannot fail the same way. */
async function notifyFailure(chat: number, detail: string) {
  await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: `⚠️ Не получилось выполнить команду.\n\n${detail.slice(0, 300)}\n\nПопробуйте ещё раз или /cancel.`,
    }),
  }).catch(() => {});
}

const send = (chat: number, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", {
    chat_id: chat,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });

const edit = (
  chat: number,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {}
) =>
  tg("editMessageText", {
    chat_id: chat,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });

// --- App API --------------------------------------------------------------

async function app(path: string, init: RequestInit = {}): Promise<unknown> {
  const r = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${r.status}: ${text.slice(0, 200)}`);
  }
  const body = parsed as { success?: boolean; error?: string; details?: unknown };
  if (!r.ok || body.success === false) {
    const detail = body.details ? ` ${JSON.stringify(body.details).slice(0, 180)}` : "";
    throw new Error(`${body.error ?? r.status}${detail}`);
  }
  return parsed;
}

// --- Formatting -----------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function shorten(text: string | undefined, n: number): string {
  const c = (text ?? "").replace(/\s+/g, " ").trim();
  if (!c) return "без названия";

  // Cut by code points, not UTF-16 units. `slice` can land in the middle of a
  // surrogate pair and leave half an emoji behind, which is not valid UTF-8 —
  // Telegram then rejects the whole keyboard with "must be encoded in UTF-8",
  // and captions here are full of emoji.
  const chars = Array.from(c);
  if (chars.length <= n) return c;
  return `${chars.slice(0, n).join("")}…`;
}

function campaignCard(c: Campaign): string {
  const a = c.analytics;
  const links = c.trackedLinks.length
    ? c.trackedLinks
        .map((l) => `   • «${esc(l.label)}» → ${esc(shorten(l.destinationUrl, 46))}`)
        .join("\n")
    : "   • нет";

  const replies = c.publicReplyMessages.length
    ? c.publicReplyMessages.map((r) => `   • ${esc(shorten(r, 46))}`).join("\n")
    : "   • нет";

  return (
    `${c.isActive ? "🟢" : "⏸" } <b>${esc(shorten(c.name, 60))}</b>\n\n` +
    `🔑 <b>Слова</b>\n   ${esc(c.keywords.join(", ") || "—")}\n\n` +
    `💬 <b>Сообщение</b>\n   ${esc(shorten(c.dmMessage, 140))}\n\n` +
    `🔗 <b>Кнопки</b>\n${links}\n\n` +
    `↩️ <b>Ответы под комментарием</b>\n${replies}\n\n` +
    `📊 ${a.sent} отправок · ${a.clicks} кликов · CTR ${a.ctr}%` +
    (a.failed ? ` · ${a.failed} ошибок` : "")
  );
}

function campaignKeyboard(index: number, c: Campaign) {
  return {
    inline_keyboard: [
      [
        { text: "🔑 Слова", callback_data: `e:${index}:kw` },
        { text: "💬 Текст", callback_data: `e:${index}:msg` },
      ],
      [
        { text: "🔗 Ссылки", callback_data: `e:${index}:ln` },
        { text: "↩️ Ответы", callback_data: `e:${index}:rp` },
      ],
      [
        { text: "✏️ Название", callback_data: `e:${index}:name` },
        { text: c.isActive ? "⏸ Пауза" : "▶️ Включить", callback_data: `t:${index}` },
      ],
      [
        { text: "🗑 Удалить", callback_data: `d:${index}` },
        { text: "← К списку", callback_data: "L" },
      ],
    ],
  };
}

// --- Campaign list --------------------------------------------------------

async function loadCampaigns(chat: number): Promise<Campaign[]> {
  const res = (await app("/api/automations")) as { data?: Campaign[] };
  const campaigns = res.data ?? [];
  session(chat).campaigns = campaigns;
  return campaigns;
}

async function showList(chat: number, messageId?: number) {
  const campaigns = await loadCampaigns(chat);

  if (campaigns.length === 0) {
    const text = "Кампаний пока нет.\n\nСоздать — /new";
    if (messageId) await edit(chat, messageId, text);
    else await send(chat, text);
    return;
  }

  const active = campaigns.filter((c) => c.isActive).length;
  const text =
    `📋 <b>Кампании</b>\n\n` +
    `Всего ${campaigns.length}, активных ${active}.\n` +
    `Выберите, чтобы посмотреть и отредактировать.`;

  const keyboard = {
    inline_keyboard: campaigns.map((c, i) => [
      {
        text: `${c.isActive ? "🟢" : "⏸"} ${shorten(c.name, 32)} · ${c.analytics.sent}`,
        callback_data: `c:${i}`,
      },
    ]),
  };

  if (messageId) await edit(chat, messageId, text, { reply_markup: keyboard });
  else await send(chat, text, { reply_markup: keyboard });
}

// --- Create flow ----------------------------------------------------------

const PICKER_SIZE = 10;

/** Draws one page of the picker from what is already in the session. */
async function renderPicker(chat: number, messageId?: number) {
  const s = session(chat);
  const pages = Math.max(1, Math.ceil(s.posts.length / PICKER_SIZE));
  const page = Math.min(Math.max(s.page, 0), pages - 1);
  s.page = page;

  const from = page * PICKER_SIZE;
  const slice = s.posts.slice(from, from + PICKER_SIZE);

  const header = s.showCovered
    ? `🎬 <b>Все посты</b>\n\nСтраница ${page + 1} из ${pages} · всего ${s.posts.length}`
    : `🎬 <b>Выберите пост</b>\n\n` +
      `Без кампании: ${s.posts.length} · скрыто с кампаниями: ${s.covered.size}\n` +
      `Страница ${page + 1} из ${pages}`;

  // Indices are absolute, so a selection stays correct whatever page it was on.
  const rows: { text: string; callback_data: string }[][] = slice.map((p, i) => [
    {
      text: `${s.covered.has(p.id) ? "✅" : "🆕"} ${shorten(p.caption, 36)}`,
      callback_data: `p:${from + i}`,
    },
  ]);

  const nav: { text: string; callback_data: string }[] = [];
  if (page > 0) nav.push({ text: "‹ Назад", callback_data: `pg:${page - 1}` });
  if (page < pages - 1) nav.push({ text: "Вперёд ›", callback_data: `pg:${page + 1}` });
  if (nav.length) rows.push(nav);

  rows.push([
    {
      text: s.showCovered ? "Только без кампаний" : "Показать все посты",
      callback_data: s.showCovered ? "F" : "A",
    },
  ]);

  const markup = { reply_markup: { inline_keyboard: rows } };
  if (messageId) await edit(chat, messageId, header, markup);
  else await send(chat, header, markup);
}

/**
 * Post picker. Defaults to reels that have no campaign yet — the reason someone
 * opens /new — with the rest one button away, since a second campaign on the
 * same post is occasionally wanted but rarely.
 */
async function showPosts(chat: number, showCovered = false, messageId?: number) {
  const s = session(chat);

  // Reuse what is already loaded when only the filter or page changed.
  if (s.posts.length === 0 || s.showCovered !== showCovered) {
    await send(chat, "Загружаю публикации…");

    const [postsRes, campaigns] = await Promise.all([
      app("/api/instagram/posts?all=true") as Promise<{ data?: Post[] }>,
      loadCampaigns(chat),
    ]);

    const all = postsRes.data ?? [];
    const covered = new Set(campaigns.map((c) => c.postId).filter(Boolean) as string[]);

    Object.assign(s, blank(), {
      campaigns,
      covered,
      showCovered,
      posts: showCovered ? all : all.filter((p) => !covered.has(p.id)),
    });

    if (s.posts.length === 0) {
      await send(chat, "Свободных постов нет — на всех уже есть кампании.", {
        reply_markup: {
          inline_keyboard: [[{ text: "Показать все посты", callback_data: "A" }]],
        },
      });
      return;
    }
    messageId = undefined;
  }

  await renderPicker(chat, messageId);
}

const ASK: Record<CreateStep, string> = {
  keywords:
    "🔑 <b>Шаг 1 из 4 · Ключевые слова</b>\n\n" +
    `Через запятую, до ${MAX_KEYWORDS} штук.\n\n` +
    "<code>+, цена, remax</code>",
  replies:
    "↩️ <b>Шаг 2 из 4 · Ответы под комментарием</b>\n\n" +
    `Каждый вариант с новой строки, до ${MAX_REPLIES}. ` +
    "Бот будет их чередовать, чтобы ответы не выглядели одинаково.\n\n" +
    "<code>-</code> — публично не отвечать.",
  links:
    "🔗 <b>Шаг 3 из 4 · Ссылки</b>\n\n" +
    `До ${MAX_LINKS} штук, каждая с новой строки. Подпись кнопки после «|»:\n\n` +
    "<code>https://example.com/product | Открыть товар</code>\n\n" +
    `Без подписи возьму «${DEFAULT_BUTTON}». <code>-</code> — без ссылок.`,
  message:
    "💬 <b>Шаг 4 из 4 · Текст в директ</b>\n\n" +
    `До ${MAX_MESSAGE_LEN} символов.\n` +
    "<code>{username}</code> — имя написавшего, <code>{link}</code> — ссылка в тексте.\n\n" +
    "Ссылки и так уйдут кнопками, дублировать не обязательно.",
};

const STEP_ORDER: CreateStep[] = ["keywords", "replies", "links", "message"];

// Every step gets the same pair. From the first step "back" lands on the post
// picker, which is still useful — picking the wrong reel is easy and would
// otherwise cost a full restart.
const STEP_KEYBOARD = {
  inline_keyboard: [
    [{ text: "← Назад", callback_data: "B" }],
    [{ text: "✖️ Отменить создание", callback_data: "X" }],
  ],
};

async function askStep(chat: number, step: CreateStep) {
  session(chat).step = step;
  await send(chat, ASK[step], { reply_markup: STEP_KEYBOARD });
}

/** Everything collected so far, for a last look before anything is written. */
function draftSummary(s: Session): string {
  const links = s.links.length
    ? s.links.map((l) => `   • «${esc(l.label)}» → ${esc(l.url)}`).join("\n")
    : "   • нет";
  const replies = s.replies.length
    ? s.replies.map((r) => `   • ${esc(shorten(r, 44))}`).join("\n")
    : "   • нет";

  return (
    "🧾 <b>Проверьте перед созданием</b>\n\n" +
    `🎬 ${esc(shorten(s.post?.caption, 52))}\n\n` +
    `🔑 <b>Слова</b>\n   ${esc(s.keywords.join(", "))}\n\n` +
    `🔗 <b>Кнопки</b>\n${links}\n\n` +
    `↩️ <b>Ответы под комментарием</b>\n${replies}\n\n` +
    `💬 <b>Сообщение</b>\n   ${esc(shorten(s.message, 160))}`
  );
}

async function showConfirm(chat: number, s: Session) {
  s.step = undefined;
  await send(chat, draftSummary(s), {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Создать", callback_data: "OK" }],
        [
          { text: "← Изменить текст", callback_data: "B" },
          { text: "✖️ Отменить", callback_data: "X" },
        ],
      ],
    },
  });
}

// --- Parsing shared by create and edit -------------------------------------

function parseKeywords(text: string): string[] | string {
  const words = text.split(",").map((w) => w.trim()).filter(Boolean);
  if (words.length === 0) return "Нужно хотя бы одно слово. Например: <code>+, цена</code>";
  if (words.length > MAX_KEYWORDS) return `Слишком много: ${words.length}. Максимум ${MAX_KEYWORDS}.`;
  const long = words.find((w) => w.length > MAX_KEYWORD_LEN);
  if (long) return `Слово «${esc(long)}» длиннее ${MAX_KEYWORD_LEN} символов.`;
  return words;
}

function parseReplies(text: string): string[] | string {
  if (SKIP.has(text.trim().toLowerCase())) return [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_REPLIES) return `Слишком много: ${lines.length}. Максимум ${MAX_REPLIES}.`;
  return lines;
}

function parseLinks(text: string): Link[] | string {
  if (SKIP.has(text.trim().toLowerCase())) return [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_LINKS) {
    return `Ссылок ${lines.length}, а Instagram примет только ${MAX_LINKS} кнопки.`;
  }
  const out: Link[] = [];
  for (const line of lines) {
    const [url, label] = line.split("|").map((p) => p.trim());
    if (!/^https?:\/\//i.test(url)) return `Не похоже на ссылку: ${esc(url)}`;
    out.push({ url, label: (label || DEFAULT_BUTTON).slice(0, MAX_BUTTON_LEN) });
  }
  return out;
}

// --- Create ---------------------------------------------------------------

async function createCampaign(chat: number, s: Session, message: string) {
  const post = s.post;
  if (!post) {
    await send(chat, "Пост потерялся. Начните заново: /new");
    return;
  }

  const [first, second] = s.links;
  try {
    await app("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        name: shorten(post.caption, 60),
        postId: post.id,
        postUrl: post.permalink,
        keywords: s.keywords,
        dmMessage: message,
        publicReplyEnabled: s.replies.length > 0,
        publicReplyMessages: s.replies,
        trackedDestinationUrl: first?.url ?? "",
        linkButtonLabel: first?.label ?? null,
        secondaryDestinationUrl: second?.url ?? "",
        secondaryButtonLabel: second?.label ?? null,
        isActive: true,
        wholeWordMatch: true,
      }),
    });
  } catch (e) {
    await send(chat, `⚠️ Не получилось: ${esc(e instanceof Error ? e.message : String(e))}`);
    return;
  }

  s.step = undefined;
  s.post = undefined;
  s.message = undefined;
  // Force a reload so this post shows as covered next time.
  s.posts = [];

  await send(
    chat,
    "✅ <b>Кампания создана</b>\n\n" +
      `🔑 ${esc(s.keywords.join(", "))}\n` +
      `🔗 кнопок: ${s.links.length}\n` +
      `↩️ ответов: ${s.replies.length}\n\n` +
      "Посмотреть и отредактировать — /list" +
      (PANEL_URL ? `\n${PANEL_URL}/campaigns` : "")
  );
}

async function handleCreateStep(chat: number, s: Session, text: string) {
  switch (s.step) {
    case "keywords": {
      const r = parseKeywords(text);
      if (typeof r === "string") return void (await send(chat, r));
      s.keywords = r;
      await send(chat, `✅ ${esc(r.join(", "))}`);
      return void (await askStep(chat, "replies"));
    }
    case "replies": {
      const r = parseReplies(text);
      if (typeof r === "string") return void (await send(chat, r));
      s.replies = r;
      await send(chat, `✅ вариантов: ${r.length}`);
      return void (await askStep(chat, "links"));
    }
    case "links": {
      const r = parseLinks(text);
      if (typeof r === "string") return void (await send(chat, r));
      s.links = r;
      await send(chat, `✅ кнопок: ${r.length}`);
      return void (await askStep(chat, "message"));
    }
    case "message": {
      const message = text.trim();
      if (!message) return void (await send(chat, "Текст не может быть пустым."));
      if (message.length > MAX_MESSAGE_LEN) {
        return void (await send(chat, `Длина ${message.length}, максимум ${MAX_MESSAGE_LEN}.`));
      }
      s.message = message;
      return void (await showConfirm(chat, s));
    }
    default:
      await send(chat, "Начните с /new или /list.");
  }
}

// --- Edit -----------------------------------------------------------------

const EDIT_PROMPT: Record<EditField, string> = {
  kw: "🔑 <b>Новые ключевые слова</b>\n\nЧерез запятую.",
  msg: "💬 <b>Новый текст в директ</b>\n\n<code>{username}</code> подставит имя.",
  ln: `🔗 <b>Новые ссылки</b>\n\nДо ${MAX_LINKS}, каждая с новой строки, подпись после «|».\n<code>-</code> — убрать все.`,
  rp: `↩️ <b>Новые ответы под комментарием</b>\n\nКаждый с новой строки, до ${MAX_REPLIES}.\n<code>-</code> — убрать все.`,
  name: "✏️ <b>Новое название</b>",
};

async function applyEdit(chat: number, s: Session, text: string) {
  const editing = s.editing;
  if (!editing) return;

  let patch: Record<string, unknown>;

  switch (editing.field) {
    case "kw": {
      const r = parseKeywords(text);
      if (typeof r === "string") return void (await send(chat, r));
      patch = { keywords: r };
      break;
    }
    case "msg": {
      const m = text.trim();
      if (!m) return void (await send(chat, "Текст не может быть пустым."));
      if (m.length > MAX_MESSAGE_LEN) {
        return void (await send(chat, `Длина ${m.length}, максимум ${MAX_MESSAGE_LEN}.`));
      }
      patch = { dmMessage: m };
      break;
    }
    case "ln": {
      const r = parseLinks(text);
      if (typeof r === "string") return void (await send(chat, r));
      const [first, second] = r;
      patch = {
        trackedDestinationUrl: first?.url ?? "",
        linkButtonLabel: first?.label ?? null,
        secondaryDestinationUrl: second?.url ?? "",
        secondaryButtonLabel: second?.label ?? null,
      };
      break;
    }
    case "rp": {
      const r = parseReplies(text);
      if (typeof r === "string") return void (await send(chat, r));
      patch = { publicReplyEnabled: r.length > 0, publicReplyMessages: r };
      break;
    }
    case "name": {
      const n = text.trim().slice(0, MAX_NAME_LEN);
      if (!n) return void (await send(chat, "Название не может быть пустым."));
      patch = { name: n };
      break;
    }
  }

  try {
    await app(`/api/automations?id=${encodeURIComponent(editing.id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  } catch (e) {
    return void (await send(chat, `⚠️ Не получилось: ${esc(e instanceof Error ? e.message : String(e))}`));
  }

  s.editing = undefined;
  await send(chat, "✅ Сохранено");

  const campaigns = await loadCampaigns(chat);
  const index = campaigns.findIndex((c) => c.id === editing.id);
  if (index >= 0) {
    await send(chat, campaignCard(campaigns[index]), {
      reply_markup: campaignKeyboard(index, campaigns[index]),
    });
  }
}

// --- Handlers -------------------------------------------------------------

async function handleText(chat: number, text: string) {
  const trimmed = text.trim();

  if (trimmed === "/start") {
    return void (await send(
      chat,
      "👋 <b>OpenReply</b>\n\n" +
        "/new — создать кампанию\n" +
        "/list — кампании и редактирование\n" +
        "/stats — сводка за вчера\n" +
        "/cancel — сбросить"
    ));
  }
  if (trimmed === "/new") return void (await showPosts(chat));
  if (trimmed === "/list") return void (await showList(chat));
  if (trimmed === "/stats") return void (await sendDigestNow());
  if (trimmed === "/cancel") {
    sessions.set(chat, blank());
    return void (await send(chat, "Сброшено. /new или /list"));
  }

  const s = session(chat);
  if (s.editing) return void (await applyEdit(chat, s, text));
  if (s.step) return void (await handleCreateStep(chat, s, text));

  await send(chat, "Не понял. /new — создать, /list — список.");
}

async function handleCallback(
  chat: number,
  messageId: number,
  queryId: string,
  data: string
) {
  await tg("answerCallbackQuery", { callback_query_id: queryId }, true);

  const s = session(chat);
  const [kind, a, b] = data.split(":");

  if (kind === "X") {
    sessions.set(chat, blank());
    return void (await edit(chat, messageId, "✖️ Создание отменено.\n\n/new — начать заново"));
  }

  if (kind === "B") {
    // From the confirmation screen `step` is already cleared, so treat that as
    // "one past the last step" and land back on the DM text.
    const current = s.step ? STEP_ORDER.indexOf(s.step) : STEP_ORDER.length;
    const previous = STEP_ORDER[current - 1];
    if (!previous) return void (await showPosts(chat));
    return void (await askStep(chat, previous));
  }

  if (kind === "OK") {
    if (!s.message) return void (await send(chat, "Черновик потерялся. /new"));
    await edit(chat, messageId, draftSummary(s));
    return void (await createCampaign(chat, s, s.message));
  }

  if (kind === "pg") {
    s.page = Number(a);
    return void (await renderPicker(chat, messageId));
  }

  if (kind === "A") return void (await showPosts(chat, true, messageId));
  if (kind === "F") return void (await showPosts(chat, false, messageId));

  if (kind === "L") return void (await showList(chat, messageId));

  if (kind === "p") {
    const post = s.posts[Number(a)];
    if (!post) return void (await send(chat, "Пост не найден. /new"));
    s.post = post;
    s.keywords = [];
    s.replies = [];
    s.links = [];
    s.message = undefined;
    await send(chat, `🎬 ${esc(shorten(post.caption, 60))}`);
    return void (await askStep(chat, "keywords"));
  }

  const campaign = s.campaigns[Number(a)];
  if (!campaign) return void (await send(chat, "Список устарел. /list"));

  if (kind === "c") {
    return void (await edit(chat, messageId, campaignCard(campaign), {
      reply_markup: campaignKeyboard(Number(a), campaign),
    }));
  }

  if (kind === "e") {
    s.editing = { id: campaign.id, field: b as EditField };
    return void (await send(chat, EDIT_PROMPT[b as EditField]));
  }

  if (kind === "t") {
    try {
      await app(`/api/automations?id=${encodeURIComponent(campaign.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !campaign.isActive }),
      });
    } catch (e) {
      return void (await send(chat, `⚠️ ${esc(e instanceof Error ? e.message : String(e))}`));
    }
    const campaigns = await loadCampaigns(chat);
    const index = campaigns.findIndex((c) => c.id === campaign.id);
    if (index >= 0) {
      await edit(chat, messageId, campaignCard(campaigns[index]), {
        reply_markup: campaignKeyboard(index, campaigns[index]),
      });
    }
    return;
  }

  if (kind === "d") {
    return void (await edit(
      chat,
      messageId,
      `🗑 Удалить «${esc(shorten(campaign.name, 50))}»?\n\n` +
        "Кампания и её статистика удалятся безвозвратно.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Да, удалить", callback_data: `D:${a}` },
              { text: "Отмена", callback_data: `c:${a}` },
            ],
          ],
        },
      }
    ));
  }

  if (kind === "D") {
    try {
      await app(`/api/automations?id=${encodeURIComponent(campaign.id)}`, {
        method: "DELETE",
      });
    } catch (e) {
      return void (await send(chat, `⚠️ ${esc(e instanceof Error ? e.message : String(e))}`));
    }
    await edit(chat, messageId, "🗑 Кампания удалена.");
    return void (await showList(chat));
  }
}

async function main() {
  console.log("[bot] запущен");
  // Health alerts and the morning digest share this process.
  startMonitor();
  let offset = 0;

  for (;;) {
    try {
      const r = await fetch(`${TG}/getUpdates?timeout=30&offset=${offset}`);
      const j = (await r.json()) as {
        ok: boolean;
        result?: {
          update_id: number;
          message?: { chat: { id: number }; from?: { id: number }; text?: string };
          callback_query?: {
            id: string;
            data?: string;
            from?: { id: number };
            message?: { chat: { id: number }; message_id: number };
          };
        }[];
      };
      if (!j.ok) {
        await new Promise((res) => setTimeout(res, 5000));
        continue;
      }

      for (const u of j.result ?? []) {
        offset = u.update_id + 1;

        const from = u.message?.from?.id ?? u.callback_query?.from?.id;
        // Anyone can find a bot by name; only the operator may drive it.
        if (String(from) !== String(ALLOWED_USER)) continue;

        try {
          if (u.callback_query?.data && u.callback_query.message) {
            await handleCallback(
              u.callback_query.message.chat.id,
              u.callback_query.message.message_id,
              u.callback_query.id,
              u.callback_query.data
            );
          } else if (u.message?.text) {
            await handleText(u.message.chat.id, u.message.text);
          }
        } catch (e) {
          // One bad update must not kill the polling loop — but it must not
          // vanish either, or the bot looks frozen.
          const detail = e instanceof Error ? e.message : String(e);
          console.error("[bot] update:", detail);
          const chat =
            u.message?.chat.id ?? u.callback_query?.message?.chat.id;
          if (chat) await notifyFailure(chat, detail);
        }
      }
    } catch (e) {
      console.error("[bot]", e instanceof Error ? e.message : e);
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}

void main();
