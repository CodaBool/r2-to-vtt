# Purpose
Downloads provided markdown files from R2 on the given cron.
Opens the LevelDB FoundryVTT Journal entry specified in R2_MAP.
Replaces the contents with the markdown contents after converting to html.

I use this in my FoundryVTT to automatically update notes from Obsidian to the VTT.

# variables
> their default value is given

- R2_BUCKET=obsidian
- R2_MAP="vtt/main.md=JournalEntry.bU74NB9zY54ctC3T.JournalEntryPage.4XNteNhTRkwHWTrF"
ENV CRON_SCHEDULE="0 3 * * *"
- CRON_SCHEDULE=/sync

# env var
> expects a .env with these values

```env
CF_ACCOUNT_ID=
CF_ACCESS_ID=
CF_ACCESS_SECRET=
```

# usage
```
docker run --env-file .env -d -v "/foundryFolder/Data/worlds/test/data/journal:/app/journal" --name r2-to-vtt r2-to-vtt
```
