FROM node:24-alpine
WORKDIR /app

# crond + su
RUN apk add --no-cache busybox-suid


ENV R2_BUCKET=obsidian
ENV R2_MAP="vtt/main.md=JournalEntry.bU74NB9zY54ctC3T.JournalEntryPage.4XNteNhTRkwHWTrF"
ENV CRON_SCHEDULE="0 3 * * *"

COPY main.js package.json entrypoint.sh ./
RUN npm install

# Prepare writable dirs for appuser
RUN mkdir -p /sync /var/log && chown -R node:node /app /sync /var/log

RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
