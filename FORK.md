# What this fork adds

[OpenReply](https://github.com/diwenne/openreply) upstream deploys to Vercel and
Railway and is driven from its web dashboard. This fork runs the whole thing on
one VPS and adds a Telegram bot for daily use.

Nothing here is upstream. `git pull` will not bring these files, and merging
upstream changes means keeping them by hand.

## Added

| Path | What it is |
| --- | --- |
| `deploy/` | Single-VPS deployment: Dockerfile, compose, nginx, bootstrap, preflight, backups, cron — see [DEPLOY.md](DEPLOY.md) |
| `bot/telegram-bot.ts` | Create and edit campaigns from Telegram — see [docs/telegram-bot.md](docs/telegram-bot.md) |
| `bot/monitor.ts` | Health alerts and a morning digest through the same bot |
| `lib/bot-auth.ts` | API-key authentication, so the bot works without a browser session |
| `deploy/multi/` | Many client instances on one server: shared Postgres, per-client stack, provisioning |
| `docs/onboarding.md` | Step-by-step runbook for adding a client |
| `docs/multi-client.md` | Why the per-client model avoids Meta App Review, and what it costs |

## Changed

**`lib/utils/keyword-matcher.ts`** — a bare `+` now matches.

Upstream has since fixed the Unicode side of this independently, and gone
further: diacritic folding and Arabic-script normalisation. That work is kept as
the base here. What it does not cover is a keyword made only of symbols — and
"put a + in the comments" is one of the most common triggers there is. The
cleaner strips `+` as punctuation, and whole-word matching has no boundary to
anchor it to.

This fork folds `➕` onto `+` before emoji are stripped, keeps `+` as a
meaningful character, and falls back to substring matching for a symbol-only
keyword. Covered by tests.

**`lib/tracking/message.ts`** — tracked links read `PUBLIC_LINK_URL`, falling
back to `NEXTAUTH_URL`.

One variable used to decide both how the operator reaches the dashboard and
which host subscribers open. Those are different audiences and can be blocked
differently; conflating them means fixing one breaks the other. Optional — unset
it and behaviour is unchanged.

**`app/api/automations/route.ts`**, **`app/api/instagram/posts/route.ts`** —
accept the bot's API key in addition to a session cookie.

## Reading order

1. [DEPLOY.md](DEPLOY.md) — install, environment, operations, and the failure
   modes worth knowing before they happen
2. [docs/telegram-bot.md](docs/telegram-bot.md) — bot setup and commands
3. [docs/onboarding.md](docs/onboarding.md) — adding a client, start to finish
4. [docs/multi-client.md](docs/multi-client.md) — the reasoning behind that model
5. Upstream [docs/setup.md](docs/setup.md) — the Meta app, still the slow part

## License

MIT, as upstream.
