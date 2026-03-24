FROM node:24-alpine

WORKDIR /app

# Install cron
RUN apk add --no-cache curl

# Copy dependency files first for better layer caching
COPY package* .

# Install dependencies
RUN npm install

# Copy app source
COPY main.js entrypoint.sh ./

# Install supercronic
RUN curl -fsSLo /usr/local/bin/supercronic \
      https://github.com/aptible/supercronic/releases/latest/download/supercronic-linux-amd64 \
    && chmod +x /usr/local/bin/supercronic
    
RUN chmod +x /app/entrypoint.sh

# Defaults, can be overridden at runtime
ENV R2_BUCKET=obsidian
ENV R2_MAP="vtt/main.md=JournalEntry.bU74NB9zY54ctC3T.JournalEntryPage.4XNteNhTRkwHWTrF"
ENV CRON_SCHEDULE="0 3 * * *"

ENTRYPOINT ["/app/entrypoint.sh"]
