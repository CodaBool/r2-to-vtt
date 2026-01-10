#!/bin/sh
set -e

# Default: run once a day at 3:00 AM
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

echo "[entrypoint] Using CRON_SCHEDULE='${CRON_SCHEDULE}'"

# Write crontab for root
# busybox crond on Alpine reads /etc/crontabs/root by default
mkdir -p /etc/crontabs

# One job: run your script with all env vars that existed when crond started
# and log to /var/log/cron.log
echo "${CRON_SCHEDULE} node /app/main.js >> /proc/1/fd/1 2>&1" > /etc/crontabs/root

# Optional: show resulting crontab
echo "[entrypoint] Installed crontab:"
cat /etc/crontabs/root

# Make sure log dir exists
mkdir -p /var/log

# Start cron in foreground
exec crond -f -l 4
