#!/usr/bin/env bash
# Start (or restart, or rebuild) one client instance.
#
#   bash deploy/multi/start.sh acme
#   bash deploy/multi/start.sh acme --build
set -euo pipefail

CLIENT="${1:?usage: start.sh <client> [--build]}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/clients/$CLIENT/.env"

[[ -f "$ENV_FILE" ]] || { echo "No such client: $CLIENT"; exit 1; }

cd "$DIR"
docker compose -p "openreply-$CLIENT" -f docker-compose.client.yml \
    --env-file "$ENV_FILE" up -d ${2:+"$2"}

PORT=$(grep '^CLIENT_PORT=' "$ENV_FILE" | cut -d= -f2-)
echo
echo "waiting for health…"
for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
        curl -sS "http://127.0.0.1:$PORT/api/health"; echo; exit 0
    fi
    sleep 3
done
echo "not healthy yet — docker compose -p openreply-$CLIENT logs web"
