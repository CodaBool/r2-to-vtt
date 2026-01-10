FROM node:24-alpine
WORKDIR /app

# crontab
RUN apk add --no-cache busybox-suid

ENV R2_BUCKET=obsidian
ENV WATCH_PREFIX=vtt
ENV LOCAL_ROOT=/sync
ENV R2_OBJECT_KEYS=main.md,other.md
ENV CHECK_WINDOW_SECONDS=86400
ENV CHECK_INTERVAL_SECONDS=86400

COPY main.js package.json crontab .
RUN npm install

RUN crontab /app/crontab
RUN mkdir -p /var/log

CMD ["crond", "-f", "-l", "4"]
