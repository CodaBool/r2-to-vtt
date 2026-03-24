#!/bin/sh
set -e

CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

echo "[entrypoint] Using CRON_SCHEDULE='${CRON_SCHEDULE}'"

mkdir -p /etc/crontabs

cat > /etc/crontabs/root <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${CRON_SCHEDULE} echo "[cron] hit \$(date -Iseconds)" >> /proc/1/fd/1 2>&1; su node -s /bin/sh -c '/usr/local/bin/node /app/main.js' >> /proc/1/fd/1 2>&1
EOF

chmod 600 /etc/crontabs/root

echo "[entrypoint] Installed crontab:"
ls -l /etc/crontabs/root
cat /etc/crontabs/root

exec crond -f -d 0 -c /etc/crontabs
