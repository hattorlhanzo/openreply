# Self-hosting on one VPS

Upstream `docs/setup.md` targets Vercel + Railway. This document covers the
single-VPS path used by this fork: Docker Compose for the app, nginx with
Let's Encrypt in front, and a Telegram bot for day-to-day work.

Everything referenced here lives in `deploy/` and `bot/`. **None of it exists
upstream** — `git pull` will not bring it, and a fresh clone will not have it.

Replace `example.com` and `<SERVER_IP>` with your own throughout.

---

## What runs where

```
   Meta webhooks ─┐
   subscribers  ──┼─► openreply.example.com ─► nginx ─► web (Next.js)
   dashboard    ──┘                                      │
                                                  worker (BullMQ)
                                                  bot    (Telegram)
                                                         │
                                              postgres + redis
```

Five containers from two images: `web`, `worker` and `bot` share one build;
`postgres` and `redis` are stock. Postgres and Redis are not published to the
host — only the compose network reaches them. The web app listens on
`127.0.0.1:3000`, so nginx is the only way in.

## Requirements

- Debian or Ubuntu with root, 2 GB RAM minimum (a swapfile covers `next build`)
- A domain pointing at the server. Meta refuses a bare IP for webhooks, and
  Let's Encrypt needs a name
- A Meta app, a Resend account with a verified sender domain

## Install

```bash
git clone <your-fork> /opt/openreply
cd /opt/openreply

bash deploy/preflight.sh openreply.example.com     # connectivity, ports, RAM, DNS
sudo bash deploy/bootstrap.sh openreply.example.com you@example.com
bash deploy/gen-env.sh openreply.example.com       # generates secrets
nano deploy/.env                                   # fill in Resend + Meta
cd deploy && docker compose -f docker-compose.prod.yml up -d --build
```

`preflight.sh` is worth running first. It checks the one thing that decides
whether any of this can work: whether the box can reach `graph.facebook.com`.

`bootstrap.sh` adds swap, installs Docker, and — **only if ports 80/443 are
free** — installs nginx and issues a certificate. If something else already
serves those ports it leaves them alone and prints the site block to add to
that proxy instead, so it cannot evict a running service.

Verify with `curl -s https://openreply.example.com/api/health`. It must report
`status: ok` and **`worker.healthy: true`**; without the worker, webhooks arrive
and nothing is ever sent.

## Environment

`deploy/gen-env.sh` generates the secrets. Two variables deserve attention:

**`ENCRYPTION_KEY`** encrypts Instagram tokens at rest. Identical across web and
worker, and never regenerated — a new key makes every connected account
undecryptable and forces a reconnect. A database dump without this key is
useless, so back them up together.

**`NEXTAUTH_URL`** drives Auth.js, the Instagram OAuth redirect, *and* the host
baked into tracked links inside DMs. If the dashboard and the public links need
different hostnames, set `PUBLIC_LINK_URL` for the links; it falls back to
`NEXTAUTH_URL` when unset. See "Two audiences" below.

`EMAIL_FROM` must sit on the exact domain verified in Resend. A subdomain of a
verified domain is not covered, and login mail silently stops.

## Two audiences, sometimes two hostnames

Two different parties must reach this server, and they can be blocked
differently:

- **Meta and subscribers** need the public hostname — webhooks, and the
  `/r/<slug>` links inside every DM.
- **The operator** needs the dashboard.

Where both reach the same hostname, one value is enough. Where they cannot —
an operator whose ISP filters the public entry point, for instance — give the
dashboard its own hostname in `NEXTAUTH_URL` and pin the links to the public one
with `PUBLIC_LINK_URL`.

Getting this backwards is expensive: links already delivered cannot be edited,
and Instagram allows exactly one private reply per comment, so a broken link
cannot be resent. Check a real `/r/<slug>` from a subscriber's network after
any change to either variable.

If you have no domain to spare, [sslip.io](https://sslip.io) resolves
`anything-<dashed-ip>.sslip.io` to that IP, and Let's Encrypt issues for it
normally. Avoid a hosting provider's shared service domain: its certificate
rate limit is consumed by every other customer.

## Operations

**Update**

```bash
cd /opt/openreply && git pull
cd deploy && docker compose -f docker-compose.prod.yml up -d --build
```

Migrations apply automatically through the `migrate` service.

**Backups** — `deploy/backup.sh` runs nightly from cron: a gzipped `pg_dump`
plus a copy of `.env`, verified with `gzip -t`, 14 days retained in
`/opt/backups`. It refuses to rotate when a dump looks empty, so a silent
failure cannot quietly overwrite good copies. They sit on the same disk as the
database, so download them periodically — they protect against a bad migration,
not against losing the machine.

**Crons** — three jobs replace the ones in `vercel.json`: token refresh, next-reel
attachment, follower snapshots. `deploy/cron.sh` calls them on localhost and
reads `CRON_SECRET` by grepping `.env` rather than sourcing it, because
`EMAIL_FROM` contains angle brackets a shell would treat as redirection.

**Diagnosis** — the Postgres tables answer faster than logs: `WebhookEvent` for
delivery, `DmLog` for send status and errors, `OperationalEvent` for worker
crashes and polling sweeps.

## Things that will bite you

**HTTP/2 and deep packet inspection.** Some networks reset the multiplexed
connection a browser uses to pull a dozen JS chunks at once: the console shows
`ERR_HTTP2_PING_FAILED` and the page hangs on skeletons forever, while `curl`
works perfectly because it requests sequentially. `deploy/nginx-openreply.conf`
therefore omits `http2 on;`. Each file gets its own connection, and the page
loads.

**Docker Hub rate limits.** On a provider with shared outbound addresses,
anonymous pulls hit `429 Too Many Requests` and the build dies fetching the Node
base image. A registry mirror in `/etc/docker/daemon.json` fixes it:

```json
{ "registry-mirrors": ["https://mirror.gcr.io"] }
```

**Tracked links versus plain URLs.** A tappable button only exists when the
campaign has a tracked link. A URL typed into the message body goes out as text,
which Instagram does not linkify — the recipient has to copy it by hand, and
almost nobody does. Campaigns built that way show 0% CTR while otherwise
identical ones sit above 30%.

**Development mode hides comments.** While the Meta app is unpublished, the
comments edge returns an empty array *with pagination cursors* even though
`comments_count` is non-zero: Standard Access serves aggregates and strips the
items. Polling can never see a comment in that state. Webhooks carry the comment
text in the payload and sidestep it entirely — which is why the app must be
published (Live), a step that needs the policy URLs but not App Review.

**Non-Latin keywords and `+`.** Upstream's matcher strips anything outside
`[A-Za-z0-9_]`, so Cyrillic keywords and a bare `+` — a very common trigger —
never match. This fork fixes it; see `lib/utils/keyword-matcher.ts` and its
tests.
