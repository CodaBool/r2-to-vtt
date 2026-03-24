#!/bin/sh
set -eu

CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
R2_BUCKET="${R2_BUCKET:-obsidian}"
R2_MAP="${R2_MAP:-placeholder}"

echo "[entrypoint] Starting Supercronic"
echo "[entrypoint] CRON_SCHEDULE=${CRON_SCHEDULE}"
echo "[entrypoint] R2_BUCKET=${R2_BUCKET}"
echo "[entrypoint] R2_MAP=${R2_MAP}"
echo "[entrypoint] uid=$(id -u) gid=$(id -g)"

CRON_FILE="/tmp/crontab"

cat > "${CRON_FILE}" <<EOF
${CRON_SCHEDULE} /usr/local/bin/node /app/main.js
EOF

echo "[entrypoint] Installed crontab:"
cat "${CRON_FILE}"

exec /usr/local/bin/supercronic "${CRON_FILE}"
