import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import fs from "fs"
import path from "path"
import stream from "stream"
import { promisify } from "util"
import { Level } from "level"
import { marked } from "marked"

const pipeline = promisify(stream.pipeline)

// Mapping of R2 object key -> Foundry journal page UUID, from env
// Example:
//   R2_MAP="vtt/main.md=JournalEntry.qmkgJyYvg71ZzLTv.JournalEntryPage.cz1pyuSxogMvrkCO,other.md=JournalEntry...."
function parseKeyToUuidMap(str) {
  const out = {}
  if (!str) return out

  for (const pair of str.split(",")) {
    const [rawKey, rawUuid] = pair.split("=").map(s => s.trim())
    if (!rawKey || !rawUuid) continue
    out[rawKey] = rawUuid
  }

  return out
}

async function normalizeJournalOwnership(dir) {
  const currentPath = path.join(dir, "CURRENT")

  let stat
  try {
    stat = await fs.promises.stat(currentPath)
  } catch (e) {
    console.warn(
      `[sync] ownership normalize: no CURRENT file in "${dir}", skipping`,
    )
    return
  }

  const uid = stat.uid
  const gid = stat.gid

  console.log(
    `[sync] normalizing ownership in "${dir}" to uid=${uid} gid=${gid}`,
  )

  const entries = await fs.promises.readdir(dir)

  for (const name of entries) {
    const p = path.join(dir, name)
    try {
      await fs.promises.chown(p, uid, gid)
    } catch (e) {
      console.warn(`[sync] chown failed for ${p}: ${e.message}`)
    }
  }
}

const KEY_TO_UUID = parseKeyToUuidMap(process.env.R2_MAP)
if (!Object.keys(KEY_TO_UUID).length) {
  console.error(
    "R2_MAP env var is required and must contain at least one key=uuid pair",
  )
  process.exit(1)
}

/* ---------------- S3 CLIENT ---------------- */

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CF_ACCESS_ID,
    secretAccessKey: process.env.CF_ACCESS_SECRET,
  },
})

/* ---------------- HELPERS: R2 / FILES ---------------- */

/**
 * Download a single object via GetObject and replace the local file.
 * Returns the local file path written.
 */
async function downloadObject(key) {
  console.log(`[get] downloading ${key}`)

  const res = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    }),
  )

  const localPath = path.join("/sync", key)
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true })

  await pipeline(res.Body, fs.createWriteStream(localPath))

  console.log(`[get] wrote ${localPath}`)
  return localPath
}

/* ---------------- HELPERS: LEVELDB / FOUNDRY ---------------- */

/**
 * Parse a Foundry journal page UUID like:
 *   JournalEntry.<journalId>.JournalEntryPage.<pageId>
 */
function parseJournalPageUuid(uuid) {
  const parts = String(uuid).split(".")
  if (
    parts.length !== 4 ||
    parts[0] !== "JournalEntry" ||
    parts[2] !== "JournalEntryPage"
  ) {
    throw new Error(`Unsupported journal page UUID format: ${uuid}`)
  }
  return {
    journalId: parts[1],
    pageId: parts[3],
  }
}

/**
 * Build the LevelDB key for a journal page.
 */
function makePageKey(journalId, pageId) {
  return `!journal.pages!${journalId}.${pageId}`
}

/**
 * Core helper: update a journal page's HTML from a markdown string.
 *
 * - Converts markdown -> HTML with `marked`
 * - Writes into page.text.content
 * - Preserves flags/_stats/etc.
 */
async function updateJournalPageFromMarkdown(db, uuid, markdown) {
  const { journalId, pageId } = parseJournalPageUuid(uuid)
  const key = makePageKey(journalId, pageId)

  const raw = await db.get(key).catch(err => {
    if (err && err.notFound) {
      throw new Error(`Cannot write: page not found for key ${key}`)
    }
    throw err
  })

  const page = JSON.parse(raw)

  const htmlContent = marked(markdown)

  if (!page.text || typeof page.text !== "object") {
    page.text = {}
  }

  // Foundry HTML mode
  page.text.format = 1
  page.text.content = htmlContent

  if (!page._stats || typeof page._stats !== "object") {
    page._stats = {}
  }
  page._stats.modifiedTime = Date.now()

  const updatedRaw = JSON.stringify(page)
  await db.put(key, updatedRaw)

  console.log(`\n=== WRITE PAGE (${uuid}) ===`)
  console.log(`Updated key: ${key}`)
}

/* ---------------- MAIN ---------------- */

async function main() {
  console.log(`[sync] bucket=${process.env.R2_BUCKET}`)
  console.log("[sync] mappings (R2_MAP):", KEY_TO_UUID)

  // Ensure local root exists
  await fs.promises.mkdir("/sync", { recursive: true })

  const resolvedJournalPath = path.resolve("/app/journal")
  console.log("Journal DB path:", resolvedJournalPath)

  // --- sanity check: journal dir + CURRENT must exist ---
  if (!fs.existsSync(resolvedJournalPath)) {
    console.error(
      `[sync] ERROR: journal dir "${resolvedJournalPath}" does not exist. Is the volume mount correct?`,
    )
    process.exit(1)
  }

  const currentFile = path.join(resolvedJournalPath, "CURRENT")
  if (!fs.existsSync(currentFile)) {
    console.error(
      `[sync] ERROR: no CURRENT file in "${resolvedJournalPath}". This does not look like a LevelDB dir.`,
    )
    process.exit(1)
  }

  // Open existing LevelDB.
  const db = new Level(resolvedJournalPath, {
    valueEncoding: "utf8",
    createIfMissing: false,
  })

  try {
    await db.open()
    console.log("[sync] LevelDB opened successfully")

    // For each mapping: download markdown, convert to HTML, write into DB
    for (const [key, uuid] of Object.entries(KEY_TO_UUID)) {
      try {
        console.log(`\n[sync] processing key="${key}" -> uuid="${uuid}"`)
        const localPath = await downloadObject(key)
        const markdown = await fs.promises.readFile(localPath, "utf8")
        await updateJournalPageFromMarkdown(db, uuid, markdown)
      } catch (err) {
        console.error(`[sync] error processing key="${key}"`, err)
      }
    }

    // 🔧 NEW: normalize ownership so new files match existing ones
    await normalizeJournalOwnership(resolvedJournalPath)

    console.log("[sync] done")
  } finally {
    await db.close()
  }
}

main().catch(err => {
  // Special case: locked DB when Foundry/world is running
  if (err && err.cause && err.cause.code === "LEVEL_LOCKED") {
    console.error(
      "[sync] LevelDB is locked: another process (likely Foundry) is using this world journal.\n" +
        "       Run this sync when the world/Foundry is stopped, or point it at a copy of the journal dir.",
    )
    process.exit(0)
  }

  console.error("[sync] fatal error", err)
  process.exit(1)
})
