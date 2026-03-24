#!/bin/sh
set -e

CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
CRON_DIR=/tmp/crontabs

echo "[entrypoint] Using CRON_SCHEDULE='${CRON_SCHEDULE}'"

mkdir -p "$CRON_DIR"

cat > "$CRON_DIR/node" <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${CRON_SCHEDULE} echo "[cron] hit \$(date -Iseconds)" >> /proc/1/fd/1 2>&1; /usr/local/bin/node /app/main.js >> /proc/1/fd/1 2>&1
EOF

chmod 600 "$CRON_DIR/node"

echo "[entrypoint] Installed crontab:"
ls -l "$CRON_DIR/node"
cat "$CRON_DIR/node"

exec crond -f -d 0 -c "$CRON_DIR"
