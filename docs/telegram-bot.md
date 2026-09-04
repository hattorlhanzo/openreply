# Telegram bot

Creates and edits campaigns without opening the dashboard, and reports on the
system so a failure is not discovered as silence.

Runs as the `bot` service from the same image as the app. Dependency-free:
long polling over global `fetch`, no library to install.

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather), copy the token
2. Get your numeric id from [@userinfobot](https://t.me/userinfobot)
3. Fill in `.env`:

```
TELEGRAM_BOT_TOKEN=123456:AA...
TELEGRAM_ALLOWED_USER_ID=12345678
BOT_API_KEY=$(openssl rand -hex 32)
```

4. `docker compose -f docker-compose.prod.yml up -d --build bot`

Leave `TELEGRAM_BOT_TOKEN` empty to run the stack without the bot.

The bot answers `TELEGRAM_ALLOWED_USER_ID` and ignores everyone else. Anyone can
find a bot by name, so this is the only thing standing between a stranger and
your campaigns — do not leave it unset.

## Commands

| Command | What it does |
| --- | --- |
| `/new` | Pick a reel → keywords → public replies → links → DM text → confirm |
| `/list` | Campaigns with stats; open one to edit, pause or delete |
| `/stats` | Yesterday's summary on demand |
| `/cancel` | Drop the current draft |

The post picker shows reels **without** a campaign first, ten per page, with the
rest one button away. Every step of the creation flow has *Back* and *Cancel*,
and nothing is written until the confirmation screen.

Links are always stored as **tracked** links, never inline in the message text —
that is what makes the DM carry a tappable button. The bot enforces the API's
limits before calling it (10 keywords, 10 public replies, **2 links**, 20-char
button labels, 1000-char message), so mistakes come back in plain language
instead of a raw validation error.

Two links is Instagram's own ceiling for this message type, not a choice.

## Alerts and the digest

`bot/monitor.ts` runs inside the same process and checks every ten minutes:

- **Worker down** — no heartbeat, so nothing is being sent
- **Instagram token expiring** — within 14 days
- **Send failures** — more than five in an hour, and outnumbering successes

Each condition alerts once and stays quiet until it clears, then reports
recovery. A ten-minute check would otherwise turn one outage into a wall of
identical messages. The failure threshold is deliberately not "any failure":
blocked users and closed messaging windows make a few failures normal.

The morning digest lands at `BOT_DIGEST_HOUR_UTC` (default 06:00 UTC) with
yesterday's sends, clicks, CTR and top campaigns.

## How it authenticates

The dashboard uses an Auth.js session cookie, which a bot cannot obtain — magic
links need a mailbox and a browser. `lib/bot-auth.ts` lets a request
authenticate with `Authorization: Bearer $BOT_API_KEY` instead, resolving to the
workspace with owner rights.

The key is compared with `timingSafeEqual`, and an unset `BOT_API_KEY`
authenticates nothing — otherwise a request with no header at all would pass.

Campaign writes go through the HTTP API so validation and tracked-link creation
stay in one place. The digest reads Postgres directly: there is no endpoint for
per-day aggregates, and adding one to serve a single consumer would be more
surface for no gain.

## Notes

Dialogue state is in memory. One operator makes that sufficient; a restart drops
an unfinished draft, which `/new` starts over anyway.

Captions are truncated by code point, not by UTF-16 unit. Cutting mid-surrogate
leaves half an emoji, which is not valid UTF-8, and Telegram rejects the entire
keyboard with `must be encoded in UTF-8`. Sequential tools never notice; the bot
would simply go quiet.

Handler failures are reported to the operator as a plain-text message with no
markup — a formatted notice could fail the same way the original did, leaving
the bot looking dead.
