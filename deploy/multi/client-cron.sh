#!/usr/bin/env bash
# Cron entry point for one client. Replaces the crons in vercel.json.
#
#   client-cron.sh <refresh-tokens|attach-next-reel|snapshot-followers> <client>
set -euo pipefail

JOB="${1:?usage: client-cron.sh <job> <client>}"
CLIENT="${2:?usage: client-cron.sh <job> <client>}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/clients/$CLIENT/.env"

# Read values without sourcing: EMAIL_FROM contains angle brackets a shell
# would treat as redirection.
val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'\'''; }

PORT="$(val CLIENT_PORT)"
SECRET="$(val CRON_SECRET)"
[[ -n "$PORT" && -n "$SECRET" ]] || { echo "$CLIENT: missing CLIENT_PORT or CRON_SECRET" >&2; exit 1; }

curl -fsS --max-time 300 -H "Authorization: Bearer $SECRET" \
     "http://127.0.0.1:$PORT/api/cron/$JOB"
echo
