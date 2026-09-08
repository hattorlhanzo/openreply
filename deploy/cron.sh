#!/usr/bin/env bash
# Replaces Vercel's cron entries (see vercel.json) with system cron.
#
#   bash deploy/cron.sh refresh-tokens
#   bash deploy/cron.sh attach-next-reel
#   bash deploy/cron.sh snapshot-followers
#
# Hits the app directly on localhost, so it does not depend on DNS or TLS.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JOB="${1:?usage: cron.sh <refresh-tokens|attach-next-reel|snapshot-followers>}"

# Read the secret without sourcing .env — EMAIL_FROM contains angle brackets
# that a shell would try to interpret as redirection.
SECRET="$(grep -E '^CRON_SECRET=' "$DIR/.env" | head -1 | cut -d= -f2- | tr -d '"'\''')"
[[ -n "$SECRET" ]] || { echo "CRON_SECRET not found in $DIR/.env" >&2; exit 1; }

curl -fsS --max-time 300 \
     -H "Authorization: Bearer ${SECRET}" \
     "http://127.0.0.1:3100/api/cron/${JOB}"
echo
