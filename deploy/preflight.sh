#!/usr/bin/env bash
# OpenReply — pre-deploy checks. Run this on the VPS BEFORE anything else.
#
#   bash deploy/preflight.sh yourdomain.com
#
# The Meta check is the one that matters. OpenReply cannot work at all if this
# server cannot reach graph.facebook.com, and that is a real risk from Russian
# datacenter IP ranges.

set -uo pipefail

DOMAIN="${1:-}"
fail=0
warn=0

green() { printf '\033[32m OK \033[0m %s\n' "$1"; }
red()   { printf '\033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail + 1)); }
yellow(){ printf '\033[33mWARN\033[0m %s\n' "$1"; warn=$((warn + 1)); }

echo "== Outbound connectivity =="

# graph.facebook.com answers 400 to a bare versioned path. Any 2xx/3xx/4xx means
# we reached Meta; a curl transport error means the route is blocked.
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
       "https://graph.facebook.com/v25.0/me" 2>/dev/null)
if [[ -n "$code" && "$code" != "000" ]]; then
    green "graph.facebook.com reachable (HTTP $code)"
else
    red "graph.facebook.com UNREACHABLE — OpenReply cannot send a single DM from this server."
    echo "     Without this there is no point continuing. See DEPLOY-BEGET.md, section 'Если Meta недоступна'."
fi

code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
       "https://api.resend.com/domains" 2>/dev/null)
if [[ -n "$code" && "$code" != "000" ]]; then
    green "api.resend.com reachable (HTTP $code) — magic-link login can send mail"
else
    red "api.resend.com UNREACHABLE — nobody will be able to log in."
fi

for host in registry.npmjs.org github.com; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://$host" 2>/dev/null)
    if [[ -n "$code" && "$code" != "000" ]]; then
        green "$host reachable (HTTP $code)"
    else
        red "$host unreachable — the Docker build will fail."
    fi
done

echo
echo "== Host requirements =="

if command -v docker >/dev/null 2>&1; then
    green "docker present ($(docker --version 2>/dev/null))"
    if docker compose version >/dev/null 2>&1; then
        green "docker compose v2 present"
    else
        red "docker compose v2 missing — install the compose plugin."
    fi
else
    red "docker missing — run deploy/bootstrap.sh, or install it manually."
fi

mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
if (( mem_mb >= 3500 )); then
    green "RAM ${mem_mb} MB"
elif (( mem_mb >= 1800 )); then
    yellow "RAM ${mem_mb} MB — enough to run, but 'next build' may OOM. Add swap (bootstrap.sh does this)."
else
    red "RAM ${mem_mb} MB — too little. Build the image elsewhere or resize the VPS."
fi

disk_gb=$(df -BG --output=avail / 2>/dev/null | tail -1 | tr -dc '0-9')
if [[ -n "${disk_gb:-}" ]] && (( disk_gb >= 10 )); then
    green "free disk ${disk_gb} GB"
else
    yellow "free disk ${disk_gb:-?} GB — images + Postgres want 10 GB or more."
fi

echo
echo "== Ports 80 / 443 =="
for port in 80 443; do
    if ss -ltn "( sport = :$port )" 2>/dev/null | tail -n +2 | grep -q .; then
        holder=$(ss -ltnp "( sport = :$port )" 2>/dev/null | tail -n +2 | head -1)
        yellow "port $port already in use — nginx will not start until it is freed:"
        echo "     $holder"
    else
        green "port $port free"
    fi
done

echo
echo "== DNS =="
if [[ -z "$DOMAIN" ]]; then
    yellow "no domain passed — rerun as: bash deploy/preflight.sh yourdomain.com"
else
    server_ip=$(curl -sS --max-time 10 https://api.ipify.org 2>/dev/null || true)
    dns_ip=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}')
    if [[ -z "$dns_ip" ]]; then
        red "$DOMAIN does not resolve — add the A record in the Beget DNS panel first."
    elif [[ -n "$server_ip" && "$dns_ip" == "$server_ip" ]]; then
        green "$DOMAIN -> $dns_ip (matches this server)"
    else
        yellow "$DOMAIN -> $dns_ip, but this server looks like ${server_ip:-unknown}."
        echo "     If you just changed DNS, wait for propagation. certbot will fail until it matches."
    fi
fi

echo
if (( fail > 0 )); then
    echo "RESULT: $fail blocking problem(s), $warn warning(s). Fix the failures before deploying."
    exit 1
fi
echo "RESULT: no blocking problems, $warn warning(s). Safe to continue."
