#!/usr/bin/env bash
# One line per client: containers up, health, campaigns, sends today.
#
#   bash deploy/multi/status.sh
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf '%-16s %-6s %-8s %s\n' CLIENT PORT HEALTH CONTAINERS

for env in "$DIR"/clients/*/.env; do
    [[ -f "$env" ]] || continue
    client="$(basename "$(dirname "$env")")"
    port="$(grep '^CLIENT_PORT=' "$env" | cut -d= -f2-)"

    health=$(curl -fsS --max-time 5 "http://127.0.0.1:$port/api/health" 2>/dev/null \
             | grep -o '"status":"[a-z]*"' | head -1 | cut -d'"' -f4)
    up=$(docker ps --filter "label=com.docker.compose.project=openreply-$client" --format '{{.Names}}' | wc -l | tr -d ' ')

    printf '%-16s %-6s %-8s %s\n' "$client" "$port" "${health:-down}" "$up"
done
