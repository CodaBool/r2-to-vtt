# Purpose
Checks if a R2 object on the watchlist has updated within the given timer.
If it has it will download and replace the local file.

I use this in my FoundryVTT to automatically update notes from Obsidian to the VTT.

# variables
> their default value is given

- R2_BUCKET=obsidian
- WATCH_PREFIX=vtt
- LOCAL_ROOT=/sync
- R2_OBJECT_KEYS=main.md,other.md
- CHECK_WINDOW_SECONDS=86400
- CHECK_INTERVAL_SECONDS=86400

# env var
> expects a .env with these values

```env
CF_ACCOUNT_ID=
CF_ACCESS_ID=
CF_ACCESS_SECRET=
```
