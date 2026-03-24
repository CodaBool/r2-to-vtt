#!/bin/sh
set -eu

CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
R2_BUCKET="${R2_BUCKET:-obsidian}"
R2_MAP="${R2_MAP}"

echo "[entrypoint] Starting container"
echo "[entrypoint] CRON_SCHEDULE=${CRON_SCHEDULE}"
echo "[entrypoint] R2_BUCKET=${R2_BUCKET}"
echo "[entrypoint] R2_MAP=${R2_MAP}"

# Ensure writable mount is owned by uid 1000 if possible
chown -R 1000:1000 /app/journal 2>/dev/null || true

cat > /etc/crontabs/root <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
R2_BUCKET=${R2_BUCKET}
R2_MAP=${R2_MAP}
${CRON_SCHEDULE} su-exec 1000:1000 /usr/local/bin/node /app/main.js >> /proc/1/fd/1 2>> /proc/1/fd/2
EOF

echo "[entrypoint] Installed crontab:"
cat /etc/crontabs/root

exec crond -f -l 2
