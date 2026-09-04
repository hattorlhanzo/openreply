#!/usr/bin/env bash
# OpenReply — one-time server setup for a Debian/Ubuntu VPS.
#
#   sudo bash deploy/bootstrap.sh yourdomain.com you@example.com
#
# Run deploy/preflight.sh FIRST. If graph.facebook.com is unreachable from this
# box, nothing below will make OpenReply work.
#
# Two front-end modes, chosen automatically:
#   * ports 80/443 free  -> installs nginx + certbot and terminates TLS here.
#   * ports 80/443 taken -> assumes an existing reverse proxy (Caddy, Traefik,
#     another nginx) already owns them, touches nothing, and prints the site
#     block you need to add to it. Never evicts whatever is already serving.

set -euo pipefail

DOMAIN="${1:?usage: sudo bash deploy/bootstrap.sh <domain> <email-for-letsencrypt>}"
LE_EMAIL="${2:-}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)."; exit 1; }

step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

port_taken() { ss -ltn "( sport = :$1 )" 2>/dev/null | tail -n +2 | grep -q .; }

step "Base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git

step "Swap"
# `next build` is the memory spike. On a 2 GB box without swap the OOM killer
# picks a victim by score, and that can be an unrelated container, not the build.
if swapon --show | grep -q .; then
    echo "swap already active, skipping"
else
    fallocate -l 3G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "3G swapfile added"
fi

step "Docker"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker + compose v2 already installed, skipping"
else
    install -m 0755 -d /etc/apt/keyrings
    . /etc/os-release
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
fi

if port_taken 80 || port_taken 443; then
    step "Existing reverse proxy detected"
    echo "Ports 80/443 are already served by:"
    ss -ltnp '( sport = :80 or sport = :443 )' 2>/dev/null | tail -n +2 | sed 's/^/  /'
    echo
    echo "Leaving it alone. nginx and certbot will NOT be installed."
    echo "Add ${DOMAIN} to that proxy yourself — for Caddy, append to its Caddyfile:"
    cat <<EOF

${DOMAIN} {
	reverse_proxy openreply-web:3000
	log {
		output stdout
		format console
	}
}

EOF
    echo "Then reload it, e.g.:  docker exec <caddy-container> caddy reload --config /etc/caddy/Caddyfile"
    FRONTEND="external"
else
    step "nginx + certbot"
    apt-get install -y -qq nginx certbot
    mkdir -p /var/www/certbot

    step "TLS certificate for ${DOMAIN}"
    [[ -n "$LE_EMAIL" ]] || { echo "email argument is required to issue a certificate"; exit 1; }
    if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
        echo "certificate already present, skipping issuance"
    else
        # Temporary HTTP-only vhost: the full config references cert files that
        # do not exist yet, so nginx would refuse to start if installed now.
        cat > /etc/nginx/sites-available/openreply <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'openreply bootstrap\n'; add_header Content-Type text/plain; }
}
EOF
        ln -sf /etc/nginx/sites-available/openreply /etc/nginx/sites-enabled/openreply
        rm -f /etc/nginx/sites-enabled/default
        nginx -t && systemctl reload nginx

        certbot certonly --webroot -w /var/www/certbot \
            -d "${DOMAIN}" --agree-tos -m "${LE_EMAIL}" --non-interactive
    fi

    step "nginx reverse proxy"
    sed "s/__DOMAIN__/${DOMAIN}/g" "${DIR}/nginx-openreply.conf" \
        > /etc/nginx/sites-available/openreply
    ln -sf /etc/nginx/sites-available/openreply /etc/nginx/sites-enabled/openreply
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx

    step "Certificate auto-renewal"
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    printf '#!/bin/sh\nsystemctl reload nginx\n' \
        > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
    systemctl enable --now certbot.timer 2>/dev/null || true
    FRONTEND="nginx"
fi

step "Cron jobs (replacing vercel.json crons)"
chmod +x "${DIR}/cron.sh"
tmp_cron="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'deploy/cron.sh' > "$tmp_cron" || true
cat >> "$tmp_cron" <<EOF
0 5 * * * ${DIR}/cron.sh refresh-tokens      >> /var/log/openreply-cron.log 2>&1
0 6 * * * ${DIR}/cron.sh attach-next-reel    >> /var/log/openreply-cron.log 2>&1
0 7 * * * ${DIR}/cron.sh snapshot-followers  >> /var/log/openreply-cron.log 2>&1
EOF
crontab "$tmp_cron"
rm -f "$tmp_cron"
echo "installed 3 cron jobs"

# ufw is deliberately not enabled here. Docker writes its own iptables rules
# that bypass ufw's INPUT chain, so it gives little protection for published
# container ports while being an easy way to lock yourself out of a box that is
# already serving traffic.

cat <<EOF

$(printf '\033[1m')Server is ready (frontend: ${FRONTEND}).$(printf '\033[0m')

Next:
  1. bash ${DIR}/gen-env.sh ${DOMAIN}
  2. edit ${DIR}/.env — fill in RESEND_API_KEY and the three Meta secrets
  3. cd ${DIR} && docker compose -f docker-compose.prod.yml up -d --build
  4. curl -s https://${DOMAIN}/api/health
EOF
