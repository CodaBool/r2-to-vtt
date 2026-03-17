#!/bin/sh
set -e

CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

echo "[entrypoint] Using CRON_SCHEDULE='${CRON_SCHEDULE}'"

CRON_DIR=/tmp/crontabs
mkdir -p "$CRON_DIR"

# No chown here, since we're already non-root.
# Just make sure writable dirs exist.
mkdir -p /var/log || true

echo "${CRON_SCHEDULE} node /app/main.js >> /proc/1/fd/1 2>&1" > "$CRON_DIR/node"

echo "[entrypoint] Installed crontab:"
cat "$CRON_DIR/node"

exec crond -f -l 4 -c "$CRON_DIR"
