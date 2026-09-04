/**
 * Health alerts and the morning digest, sent through the same Telegram bot.
 *
 * Without this the failure mode is silence: the worker dies, or the Instagram
 * token expires, and nothing looks broken until someone notices no DMs went
 * out. Both loops run inside the bot process — no extra service, no extra
 * container.
 *
 * Reads go straight through Prisma. There is no HTTP endpoint for per-day
 * aggregates, and inventing one just to serve the bot would be more surface for
 * no gain; campaign *writes* still go through the API so validation and tracked
 * links stay in one place.
 */

import { prisma } from "@/lib/db/client";
import { getWorkerHealth } from "@/lib/ops/worker-health";

const CHAT = process.env.TELEGRAM_ALLOWED_USER_ID!;
const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// How often to look for trouble, and when to send the digest (server time, UTC).
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const DIGEST_HOUR_UTC = Number(process.env.BOT_DIGEST_HOUR_UTC ?? 6);
const TOKEN_WARN_DAYS = 14;

async function notify(text: string): Promise<void> {
  await fetch(`${TG}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    }),
  });
}

// Alert once per condition, then stay quiet until it clears — a check every ten
// minutes would otherwise turn one outage into a wall of identical messages.
const firing = new Set<string>();

async function alertOnce(key: string, text: string) {
  if (firing.has(key)) return;
  firing.add(key);
  await notify(text);
}

function resolve(key: string, text?: string) {
  if (!firing.delete(key)) return;
  if (text) void notify(text);
}

async function checkWorker() {
  const health = await getWorkerHealth();
  if (health.healthy) {
    resolve("worker", "✅ Воркер снова на связи.");
    return;
  }
  const age = health.ageMs ? `${Math.round(health.ageMs / 60000)} мин назад` : "никогда";
  await alertOnce(
    "worker",
    `🔴 <b>Воркер не отвечает</b>\n\nПоследний сигнал: ${age}.\n` +
      `Сообщения сейчас не отправляются.\n\n` +
      `<code>docker compose -f docker-compose.prod.yml restart worker</code>`
  );
}

async function checkToken() {
  const account = await prisma.instagramAccount.findFirst({
    select: { username: true, tokenExpiresAt: true },
  });
  if (!account?.tokenExpiresAt) return;

  const days = Math.floor(
    (account.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  if (days > TOKEN_WARN_DAYS) {
    resolve("token");
    return;
  }
  await alertOnce(
    "token",
    `🟠 <b>Токен Instagram истекает</b>\n\n` +
      `@${account.username}: осталось ${days} дн.\n` +
      `Обычно он продлевается сам. Если срок продолжит падать — переподключите аккаунт в настройках.`
  );
}

async function checkFailures() {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [failed, sent] = await Promise.all([
    prisma.dmLog.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    prisma.dmLog.count({ where: { status: "SENT", createdAt: { gte: since } } }),
  ]);

  // A couple of failures among many sends is normal (blocked users, closed
  // windows). A burst that outweighs the successes is not.
  if (failed >= 5 && failed > sent) {
    await alertOnce(
      "failures",
      `🔴 <b>Отправки падают</b>\n\nЗа час: ${failed} ошибок против ${sent} успешных.\n` +
        `Загляните в DM Logs — возможно, проблема с токеном или лимитами Meta.`
    );
  } else {
    resolve("failures");
  }
}

/** Yesterday's summary — sent on schedule, and on demand via /stats. */
export async function sendDigestNow() {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const range = { gte: start, lt: end };

  const [sent, failed, clicks, perCampaign] = await Promise.all([
    prisma.dmLog.count({ where: { status: "SENT", createdAt: range } }),
    prisma.dmLog.count({ where: { status: "FAILED", createdAt: range } }),
    prisma.linkClick.count({ where: { createdAt: range } }),
    prisma.dmLog.groupBy({
      by: ["automationId"],
      where: { status: "SENT", createdAt: range },
      _count: { _all: true },
      orderBy: { _count: { automationId: "desc" } },
      take: 3,
    }),
  ]);

  if (sent === 0 && failed === 0) {
    await notify("📊 <b>Вчера</b>\n\nОтправок не было.");
    return;
  }

  const names = new Map(
    (
      await prisma.automation.findMany({
        where: { id: { in: perCampaign.map((r) => r.automationId) } },
        select: { id: true, name: true },
      })
    ).map((a) => [a.id, a.name])
  );

  const ctr = sent > 0 ? ((clicks / sent) * 100).toFixed(1) : "0.0";
  const top = perCampaign
    .map((r, i) => `${i + 1}. ${names.get(r.automationId) ?? "?"} — ${r._count._all}`)
    .join("\n");

  await notify(
    `📊 <b>Вчера</b>\n\n` +
      `Отправлено: <b>${sent}</b>\n` +
      `Кликов: <b>${clicks}</b> · CTR ${ctr}%\n` +
      (failed ? `Ошибок: ${failed}\n` : "") +
      (top ? `\n<b>Топ кампаний</b>\n${top}` : "")
  );
}

export function startMonitor() {
  if (!CHAT || !process.env.TELEGRAM_BOT_TOKEN) return;

  let lastDigestDay = -1;

  const tick = async () => {
    try {
      await checkWorker();
      await checkToken();
      await checkFailures();

      const now = new Date();
      if (now.getUTCHours() === DIGEST_HOUR_UTC && now.getUTCDate() !== lastDigestDay) {
        lastDigestDay = now.getUTCDate();
        await sendDigestNow();
      }
    } catch (e) {
      console.error("[monitor]", e instanceof Error ? e.message : e);
    }
  };

  void tick();
  setInterval(() => void tick(), CHECK_INTERVAL_MS);
  console.log("[monitor] запущен");
}
