# Onboarding a client, step by step

One server hosts many instances. Each client gets its own database, its own
encryption key, its own Meta app and its own subdomain — nothing is shared
except Postgres and the Resend account.

Budget **about an hour for the first client** and roughly twenty minutes after
that. Almost all of it is the Meta app; the server side is one command.

---

## Before you start

Have ready:

- A domain you control, so each client can get a subdomain
- One Resend account with a verified sender domain — shared by all clients
- The client's Instagram account switched to **Business or Creator**
- A second Instagram account for testing (a campaign ignores comments from the
  connected account itself)

Prepare the server once:

```bash
git clone <your-fork> /opt/openreply
cd /opt/openreply
sudo bash deploy/bootstrap.sh placeholder.example.com you@example.com
```

`bootstrap.sh` installs Docker, adds swap and sets up nginx. Pass any hostname
you already control — per-client vhosts come later. Then add the registry
mirror, or builds will fail on a shared-IP provider:

```bash
echo '{"registry-mirrors":["https://mirror.gcr.io"]}' > /etc/docker/daemon.json
systemctl restart docker
```

---

## 1. DNS

Point the client's subdomain at the server:

| Type | Name | Value |
| --- | --- | --- |
| A | `acme` | `<SERVER_IP>` |

Wait until it resolves. The certificate cannot be issued before that:

```bash
getent ahostsv4 acme.example.com
```

## 2. Provision (one command)

```bash
sudo bash deploy/multi/provision.sh acme acme.example.com you@example.com
```

This creates the database and role, generates every secret, allocates a free
port, writes the nginx vhost, issues the certificate and registers three cron
jobs. It ends by printing the client's webhook verify token and the four URLs
you will paste into Meta.

It refuses to touch a client that already exists — a regenerated
`ENCRYPTION_KEY` would orphan every Instagram token that client has stored.

## 3. The Meta app

The slow part, and it is manual. In the **client's own** Facebook account, at
[developers.facebook.com/apps](https://developers.facebook.com/apps):

**Create the app.** Type *Business*. Use case: *Manage messaging and content on
Instagram*. Not Facebook Login, not Marketing API — either one makes the OAuth
round trip fail later with a mismatched-client error that says nothing useful.

**Collect three secrets.** Two live in different places:

| Variable | Where |
| --- | --- |
| `INSTAGRAM_APP_ID` | Instagram → API setup with Instagram login |
| `INSTAGRAM_APP_SECRET` | same page, *Show* |
| `FACEBOOK_APP_SECRET` | App settings → Basic |

The Instagram app ID is **not** the App ID on the Basic page. They are different
numbers, and using the wrong one fails at OAuth.

**Add the client's Instagram account as a tester — both halves.** In the console:
App roles → Roles → Instagram testers → invite the exact username. Then, in the
Instagram app on the client's phone: Settings → Apps and websites → Tester
invites → accept. Skipping the second half produces "Insufficient Developer
Role", and it is the single most common way this goes wrong.

**Paste the URLs** printed by `provision.sh`:

- OAuth redirect: `https://acme.example.com/api/instagram/callback` — no
  trailing slash
- Webhook callback: `https://acme.example.com/api/webhook`, with the verify
  token from the same output, then subscribe to the **`comments`** field
- Privacy, Terms, Data deletion — the instance serves all three

**Publish the app (Live).** Real webhooks are not delivered while it is in
development, and in that state the comments API returns nothing either. This
step needs the policy URLs but **not** App Review.

## 4. Fill in the rest and start

```bash
nano deploy/multi/clients/acme/.env     # Resend + the three Meta secrets
bash deploy/multi/start.sh acme --build
```

The first build takes several minutes; later clients reuse the image and start
in seconds.

Expect `status: ok` and **`worker.healthy: true`**. Without the worker, webhooks
arrive and nothing is ever sent.

## 5. Hand over and test

The client signs in at `https://acme.example.com` with a magic link, then
Settings → Connect Instagram.

Test end to end: create a campaign with a tracked link, comment the keyword from
the second account, confirm the DM arrives with a **tappable button** and that
`DM Logs` shows `SENT`.

Put the link in the campaign's tracked-link field, never inline in the message
text. Instagram does not linkify plain URLs in a DM — the recipient would have
to copy it by hand, and campaigns built that way sit at 0% CTR.

Optionally give the client a Telegram bot so they never open the dashboard —
see [telegram-bot.md](telegram-bot.md).

---

## Running the fleet

```bash
bash deploy/multi/status.sh          # every client: port, health, containers
bash deploy/multi/start.sh acme      # restart one
docker compose -p openreply-acme logs -f web
```

**Updating everyone** — build once, restart in turn:

```bash
cd /opt/openreply && git pull
for c in deploy/multi/clients/*/; do
  bash deploy/multi/start.sh "$(basename "$c")" --build
done
```

**Backups** must cover every database and every `.env`. A dump without its
client's `ENCRYPTION_KEY` cannot be decrypted:

```bash
docker exec openreply-shared-postgres-1 pg_dumpall -U postgres | gzip > all.sql.gz
tar czf envs.tar.gz deploy/multi/clients/*/.env
```

## Capacity

Measured on a live instance:

| Component | Memory |
| --- | --- |
| web | ~290 MB |
| worker | ~240 MB |
| bot | ~60 MB |
| redis (per client) | ~8 MB |
| postgres (shared) | ~45 MB |

About **600 MB per client**, plus one shared Postgres. Roughly 12 clients on
8 GB, 26 on 16 GB. The CPU sits near idle — memory is the limit.

## What breaks, and how to see it

| Symptom | Cause |
| --- | --- |
| `Insufficient Developer Role` | Tester invite not accepted inside Instagram |
| Webhook will not verify | Wrong verify token, or the app is not Live |
| Comments never trigger | Not subscribed to the `comments` field |
| `redirect_uri mismatch` | URI differs — usually a trailing slash |
| 0% CTR | Link typed into the message instead of the tracked-link field |
| Dashboard hangs on skeletons | HTTP/2 reset by the client's network — the vhost already omits it |
| Build fails on the Node image | Docker Hub rate limit; add the registry mirror |

`WebhookEvent`, `DmLog` and `OperationalEvent` in that client's database answer
faster than logs do.

## Limits worth knowing before you sell

**750 DMs per hour per Instagram account** — Meta's ceiling, enforced per
account, so clients do not compete with each other.

**One private reply per comment.** A DM cannot be corrected or resent: the
24-hour messaging window only opens if the person writes first. Check links
before a campaign goes live.

**Two link buttons per DM.** Instagram's ceiling. For more products, send one
button to a collection page.

**App Review is not needed** in this model, because each client's account is a
tester on their own app. It becomes necessary only if you want strangers
connecting to a single shared app — that brings business verification and a
screencast with it.
