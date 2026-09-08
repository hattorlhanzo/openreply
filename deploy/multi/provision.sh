#!/usr/bin/env bash
# Provision one client instance.
#
#   sudo bash deploy/multi/provision.sh acme acme.example.com you@example.com
#
# Creates the database and role, generates secrets, allocates a port, writes the
# nginx vhost, issues a certificate and starts the containers. What it cannot do
# is the Meta app — that is manual, and the script ends by printing exactly what
# to paste where.
#
# Safe to re-run: an existing client is left alone rather than reset, because a
# regenerated ENCRYPTION_KEY would make every stored Instagram token
# undecryptable.

set -euo pipefail

CLIENT="${1:?usage: provision.sh <client> <domain> <email>}"
DOMAIN="${2:?usage: provision.sh <client> <domain> <email>}"
LE_EMAIL="${3:?usage: provision.sh <client> <domain> <email>}"

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)."; exit 1; }
[[ "$CLIENT" =~ ^[a-z0-9-]+$ ]] || { echo "Client name: lowercase letters, digits, dashes."; exit 1; }

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENTS="$DIR/clients"
ENV_FILE="$CLIENTS/$CLIENT/.env"
BASE_PORT="${BASE_PORT:-3100}"

step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

if [[ -f "$ENV_FILE" ]]; then
    echo "Client '$CLIENT' already exists at $ENV_FILE."
    echo "Delete it deliberately if you really mean to start over — regenerating"
    echo "ENCRYPTION_KEY orphans every Instagram token this client has stored."
    exit 1
fi

step "Shared Postgres"
cd "$DIR"
if ! docker ps --format '{{.Names}}' | grep -q '^openreply-shared-postgres-1$'; then
    [[ -f "$DIR/.env.shared" ]] || {
        echo "POSTGRES_SUPER_PASSWORD=$(openssl rand -hex 24)" > "$DIR/.env.shared"
        chmod 600 "$DIR/.env.shared"
        echo "generated $DIR/.env.shared"
    }
    docker compose -p openreply-shared --env-file "$DIR/.env.shared" \
        -f docker-compose.shared.yml up -d
    until docker exec openreply-shared-postgres-1 pg_isready -U postgres >/dev/null 2>&1; do sleep 2; done
fi
echo "running"

step "Database for $CLIENT"
DB_PASS="$(openssl rand -hex 24)"
DB_NAME="openreply_${CLIENT//-/_}"
DB_USER="openreply_${CLIENT//-/_}"
docker exec -i openreply-shared-postgres-1 psql -U postgres -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE "$DB_USER" LOGIN PASSWORD '$DB_PASS';
CREATE DATABASE "$DB_NAME" OWNER "$DB_USER";
SQL
echo "created $DB_NAME"

step "Port"
# Next free port above BASE_PORT, skipping any already claimed by a client.
PORT=$BASE_PORT
while grep -rqs "^CLIENT_PORT=$PORT$" "$CLIENTS" 2>/dev/null || ss -ltn "( sport = :$PORT )" | tail -n +2 | grep -q .; do
    PORT=$((PORT + 1))
done
echo "$PORT"

step "Environment"
mkdir -p "$CLIENTS/$CLIENT"
umask 077
cat > "$ENV_FILE" <<ENV
# $CLIENT — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
CLIENT_PORT=$PORT
CLIENT_ENV_FILE=$ENV_FILE

NEXTAUTH_URL=https://$DOMAIN
NEXTAUTH_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -hex 32)
# Encrypts this client's Instagram tokens. Never regenerate.
ENCRYPTION_KEY=$(openssl rand -hex 32)

DATABASE_URL=postgresql://$DB_USER:$DB_PASS@postgres:5432/$DB_NAME
REDIS_URL=redis://redis:6379

# Shared across clients: one Resend account sends everyone's login mail.
RESEND_API_KEY=
EMAIL_FROM=

# From this client's own Meta app — see the checklist printed at the end.
META_GRAPH_API_VERSION=v25.0
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
FACEBOOK_APP_SECRET=
WEBHOOK_VERIFY_TOKEN=$(openssl rand -hex 16)

# Polling safety net for comments Meta's webhook drops. 60s, not the 5 min
# default: a dropped webhook otherwise shows up as a DM arriving five minutes
# late, which reads as a broken product.
COMMENT_POLL_INTERVAL_MS=60000
COMMENT_POLL_MAX_PER_SWEEP=30
COMMENT_POLL_LOOKBACK_HOURS=72

# Sign-in allowlist. Until SSO exists this is the ONLY thing stopping a stranger
# who knows the URL from requesting a magic link. Never leave it empty in prod.
ALLOWED_EMAILS=

# Telegram bot, optional. Leave the token empty to run without it.
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_ID=
BOT_API_KEY=$(openssl rand -hex 32)
ENV
chmod 600 "$ENV_FILE"
echo "$ENV_FILE"

step "nginx + certificate"
apt-get install -y -qq nginx certbot >/dev/null 2>&1 || true
mkdir -p /var/www/certbot

cat > "/etc/nginx/sites-available/openreply-$CLIENT" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}
NGINX
ln -sf "/etc/nginx/sites-available/openreply-$CLIENT" "/etc/nginx/sites-enabled/openreply-$CLIENT"
nginx -t >/dev/null && systemctl reload nginx

certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
    --agree-tos -m "$LE_EMAIL" --non-interactive

cat > "/etc/nginx/sites-available/openreply-$CLIENT" <<NGINX
# $CLIENT
# http2 is deliberately absent: some networks reset the multiplexed connection
# a browser uses for parallel chunk loads, and the dashboard hangs on skeletons.
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 10m;

    # Meta signs the webhook body; nothing here may rewrite it.
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
}
NGINX
nginx -t >/dev/null && systemctl reload nginx
echo "https://$DOMAIN"

step "Cron"
tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v "cron.sh .* $CLIENT\$" > "$tmp" || true
for job in refresh-tokens attach-next-reel snapshot-followers; do
    hour=$(( 5 + $(echo "$job" | cksum | cut -d' ' -f1) % 3 ))
    echo "0 $hour * * * PORT=$PORT $DIR/client-cron.sh $job $CLIENT >> /var/log/openreply-$CLIENT.log 2>&1" >> "$tmp"
done
crontab "$tmp"; rm -f "$tmp"
echo "3 jobs"

cat <<DONE

$(printf '\033[1m')Server side done for $CLIENT.$(printf '\033[0m')

Still to fill in $ENV_FILE:
  RESEND_API_KEY, EMAIL_FROM        (shared across clients)
  INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, FACEBOOK_APP_SECRET

Paste into that client's Meta app:
  OAuth redirect   https://$DOMAIN/api/instagram/callback
  Webhook callback https://$DOMAIN/api/webhook
  Verify token     $(grep '^WEBHOOK_VERIFY_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
  Privacy / Terms / Deletion
                   https://$DOMAIN/privacy
                   https://$DOMAIN/terms
                   https://$DOMAIN/data-deletion

Then start it:
  bash $DIR/start.sh $CLIENT
DONE
