#!/bin/sh
set -eu

CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
R2_BUCKET="${R2_BUCKET:-obsidian}"
R2_MAP="${R2_MAP}"

echo "[entrypoint] Starting container"
echo "[entrypoint] CRON_SCHEDULE=${CRON_SCHEDULE}"
echo "[entrypoint] R2_BUCKET=${R2_BUCKET}"
echo "[entrypoint] R2_MAP=${R2_MAP}"

# Write cron job
cat > /etc/crontabs/root <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
R2_BUCKET=${R2_BUCKET}
R2_MAP=${R2_MAP}
${CRON_SCHEDULE} /usr/local/bin/node /app/main.js >> /proc/1/fd/1 2>> /proc/1/fd/2
EOF

echo "[entrypoint] Installed crontab:"
cat /etc/crontabs/root

# Optional: run once at startup
#echo "[entrypoint] Running initial execution"
#node /app/main.js

echo "[entrypoint] Starting cron daemon"
exec crond -f -l 2
