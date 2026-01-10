#!/bin/sh
set -e

CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

echo "[entrypoint] Using CRON_SCHEDULE='${CRON_SCHEDULE}'"

mkdir -p /etc/crontabs

# Ensure dirs are still owned by node (in case of overlay changes)
chown -R node:node /app /sync /var/log || true

# Cron runs as root inside the container, but the job runs as user "node" (uid 1000).
# Output is redirected to PID 1 stdout so `podman logs` shows it.
echo "${CRON_SCHEDULE} su node -s /bin/sh -c 'node /app/main.js' >> /proc/1/fd/1 2>&1" > /etc/crontabs/root

echo "[entrypoint] Installed crontab:"
cat /etc/crontabs/root

exec crond -f -l 4
