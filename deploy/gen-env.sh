#!/usr/bin/env bash
# Generates deploy/.env with fresh secrets and the compose-internal DB/Redis
# URLs. Placeholders are left for the values only you can supply (Meta, Resend).
#
#   bash deploy/gen-env.sh yourdomain.com
#
# Refuses to overwrite an existing .env: regenerating ENCRYPTION_KEY would make
# every connected Instagram account undecryptable and force a reconnect.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/.env"
DOMAIN="${1:?usage: bash deploy/gen-env.sh yourdomain.com}"

if [[ -e "$ENV_FILE" ]]; then
    echo "deploy/.env already exists — not touching it."
    echo "To start over, back it up first:  mv deploy/.env deploy/.env.bak"
    exit 1
fi

command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }

PG_PASS="$(openssl rand -hex 24)"

umask 077
cat > "$ENV_FILE" <<EOF
# OpenReply — production environment. Generated $(date -u +%Y-%m-%dT%H:%M:%SZ).
# Secrets live here. chmod 600, never commit.

# --- App ---
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -hex 32)
# 32-byte hex. Encrypts Instagram tokens at rest. If this ever changes, every
# connected account has to be reconnected by hand.
ENCRYPTION_KEY=$(openssl rand -hex 32)

# --- Datastores (hostnames are compose service names) ---
POSTGRES_PASSWORD=${PG_PASS}
DATABASE_URL=postgresql://openreply:${PG_PASS}@postgres:5432/openreply
REDIS_URL=redis://redis:6379

# --- Email magic links (Resend) ---
# FILL IN. Login is magic-link only: no key, no way to sign in.
RESEND_API_KEY=
EMAIL_FROM="OpenReply <login@${DOMAIN}>"

# --- Meta / Instagram ---
# FILL IN after creating the Meta app. See DEPLOY-BEGET.md step 7.
META_GRAPH_API_VERSION=v25.0
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
FACEBOOK_APP_SECRET=
WEBHOOK_VERIFY_TOKEN=$(openssl rand -hex 16)

# --- Polling reconciler (defaults are fine) ---
COMMENT_POLL_INTERVAL_MS=60000
COMMENT_POLL_MAX_PER_SWEEP=30
COMMENT_POLL_LOOKBACK_HOURS=72
EOF

chmod 600 "$ENV_FILE"
echo "Wrote $ENV_FILE (chmod 600)."
echo
echo "Still to fill in by hand:"
echo "  RESEND_API_KEY, EMAIL_FROM"
echo "  INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, FACEBOOK_APP_SECRET"
echo
echo "Your webhook verify token (paste this into the Meta console):"
grep '^WEBHOOK_VERIFY_TOKEN=' "$ENV_FILE" | cut -d= -f2-
