#!/bin/sh
set -e

CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

echo "[entrypoint] Using CRON_SCHEDULE='${CRON_SCHEDULE}'"

mkdir -p /etc/crontabs

# Make sure appuser still owns the writable dirs
chown -R appuser:appuser /app /sync /var/log || true

# Cron runs as root; job runs as appuser (UID 999)
# Output goes to container stdout (/proc/1/fd/1) so `podman logs` sees it.
echo "${CRON_SCHEDULE} su -s /bin/sh -c 'node /app/main.js' appuser >> /proc/1/fd/1 2>&1" > /etc/crontabs/root

echo "[entrypoint] Installed crontab:"
cat /etc/crontabs/root

exec crond -f -l 4
