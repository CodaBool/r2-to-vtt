FROM node:24-alpine

WORKDIR /app

# Install cron
RUN apk add --no-cache dcron

# Copy dependency files first for better layer caching
COPY package* .

# Install dependencies
RUN npm install

# Copy app source
COPY main.js entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh

# Defaults, can be overridden at runtime
ENV R2_BUCKET=obsidian
ENV R2_MAP="vtt/main.md=JournalEntry.bU74NB9zY54ctC3T.JournalEntryPage.4XNteNhTRkwHWTrF"
ENV CRON_SCHEDULE="0 3 * * *"

CMD ["/app/entrypoint.sh"]
