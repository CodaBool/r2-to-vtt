FROM node:24-alpine
WORKDIR /app

# crontab
RUN apk add --no-cache busybox-suid

ENV R2_BUCKET=obsidian
ENV R2_MAP="vtt/main.md=JournalEntry.bU74NB9zY54ctC3T.JournalEntryPage.4XNteNhTRkwHWTrF"
ENV CRON_SCHEDULE="0 3 * * *"

COPY main.js package.json entrypoint.sh ./
RUN npm install

RUN chmod +x /app/entrypoint.sh
RUN mkdir -p /var/log

CMD ["/app/entrypoint.sh"]
