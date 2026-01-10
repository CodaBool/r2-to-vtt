#!/bin/sh
set -e

# Default: run once a day at 3:00 AM (can override with CRON_SCHEDULE env)
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

echo "[entrypoint] Using CRON_SCHEDULE='${CRON_SCHEDULE}'"

mkdir -p /etc/crontabs
mkdir -p /var/log

# Ensure appuser exists and owns working dirs
chown -R appuser:appuser /app /sync /var/log || true

# Cron will run as root, but the actual job runs as appuser (UID 999)
echo "${CRON_SCHEDULE} su -s /bin/sh -c 'node /app/main.js' appuser >> /proc/1/fd/1 2>&1" > /etc/crontabs/root

echo "[entrypoint] Installed crontab:"
cat /etc/crontabs/root

# Start cron in foreground
exec crond -f -l 4
