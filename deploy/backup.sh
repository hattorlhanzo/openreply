#!/usr/bin/env bash
# OpenReply — nightly backup of the database and the environment file.
#
#   bash deploy/backup.sh
#
# Keeps KEEP_DAYS of dumps locally. Local copies protect against a bad
# migration or an accidental delete; they do NOT protect against losing the
# machine. Download them off the box periodically:
#
#   scp root@<server>:/opt/backups/openreply-*.sql.gz .
#
# The .env is included because the dump is useless without ENCRYPTION_KEY —
# every Instagram token in the database is encrypted with it.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${BACKUP_DIR:-/opt/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT"
chmod 700 "$OUT"

cd "$DIR"
docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U openreply openreply | gzip -9 > "$OUT/openreply-$STAMP.sql.gz"

# A dump that never restored is not a backup. gzip -t catches truncation from a
# container that died mid-dump, which is exactly the case a silent cron hides.
gzip -t "$OUT/openreply-$STAMP.sql.gz"

size=$(stat -c %s "$OUT/openreply-$STAMP.sql.gz")
if (( size < 1024 )); then
    echo "backup looks empty (${size} bytes) — refusing to rotate" >&2
    exit 1
fi

cp "$DIR/.env" "$OUT/env-$STAMP"
chmod 600 "$OUT/env-$STAMP"

find "$OUT" -name 'openreply-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
find "$OUT" -name 'env-*' -mtime "+$KEEP_DAYS" -delete

echo "$(date -u +%FT%TZ) ok: openreply-$STAMP.sql.gz ($size bytes), $(ls -1 "$OUT"/openreply-*.sql.gz | wc -l) kept"
