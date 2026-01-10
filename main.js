import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import fs from "fs"
import path from "path"
import stream from "stream"
import { promisify } from "util"

const pipeline = promisify(stream.pipeline)

// -------- ENV CONFIG --------

const BUCKET = process.env.R2_BUCKET
if (!BUCKET) {
  console.error("R2_BUCKET env var is required")
  process.exit(1)
}

const ENDPOINT = `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
if (!process.env.CF_ACCOUNT_ID) {
  console.error("CF_ACCOUNT_ID env var is required")
  process.exit(1)
}

const WATCH_PREFIX = (() => {
  let p = process.env.WATCH_PREFIX || "vtt"
  // normalize to "prefix/" or "" if user really wants root
  if (p && !p.endsWith("/")) p = p + "/"
  return p
})()

// Local directory to write files into (inside container)
const LOCAL_ROOT = process.env.LOCAL_ROOT || "/sync"

// If set, we do NOT call ListObjectsV2.
// Instead we watch **only** these keys.
const OBJECT_KEYS_ENV = process.env.R2_OBJECT_KEYS || ""

// Time window (in seconds) for "how old object is allowed to be"
const CHECK_WINDOW_SECONDS = Number(
  process.env.CHECK_WINDOW_SECONDS ||
    process.env.CHECK_INTERVAL_SECONDS ||
    86400,
)
if (Number.isNaN(CHECK_WINDOW_SECONDS) || CHECK_WINDOW_SECONDS <= 0) {
  console.error("CHECK_WINDOW_SECONDS must be a positive number")
  process.exit(1)
}

// -------- S3 CLIENT --------

const s3 = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  // forcePathStyle: true, // IMPORTANT for R2
  credentials: {
    accessKeyId: process.env.CF_ACCESS_ID,
    secretAccessKey: process.env.CF_ACCESS_SECRET,
  },
})

// -------- HELPERS --------

function parseObjectKeysFromEnv() {
  if (!OBJECT_KEYS_ENV.trim()) return null

  // Comma-separated list; entries can be full keys ("vtt/foo.md") or bare names ("foo.md")
  return OBJECT_KEYS_ENV.split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(key => {
      if (WATCH_PREFIX && !key.startsWith(WATCH_PREFIX) && !key.includes("/")) {
        // treat as relative to WATCH_PREFIX if no slash
        return WATCH_PREFIX + key
      }
      return key
    })
}

/**
 * In auto-list mode, call ListObjectsV2 with the WATCH_PREFIX.
 * This is a Class A operation and will list all keys under that prefix.
 */
async function listKeysWithPrefix() {
  const keys = []
  let token

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: WATCH_PREFIX || undefined,
        ContinuationToken: token,
      }),
    )

    if (res.Contents) {
      keys.push(...res.Contents.map(o => o.Key).filter(Boolean))
    }

    token = res.NextContinuationToken
  } while (token)

  return keys
}

/**
 * Given an R2 object key, return the local filesystem path.
 * We strip WATCH_PREFIX (if present) so that "vtt/foo.md"
 * becomes "<LOCAL_ROOT>/foo.md".
 */
function localPathForKey(key) {
  let relative = key
  if (WATCH_PREFIX && key.startsWith(WATCH_PREFIX)) {
    relative = key.slice(WATCH_PREFIX.length)
  }
  return path.join(LOCAL_ROOT, relative)
}

/**
 * For a given key, call HeadObject and decide if it's within the CHECK_WINDOW_SECONDS.
 * Returns:
 *   - null if too old or head fails (404, etc.)
 *   - { key, lastModified } if we should fetch it.
 */
async function shouldFetchKey(key) {
  try {
    const res = await s3.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
      // vtt/main.md
      // obsidian/vtt/main.md
    )

    const lastModified = res.LastModified
    if (!lastModified) {
      // If no LastModified, be conservative and skip
      console.log(`[head] ${key}: no LastModified, skipping`)
      return null
    }

    const now = new Date()
    const ageSeconds = (now.getTime() - lastModified.getTime()) / 1000

    if (ageSeconds <= CHECK_WINDOW_SECONDS) {
      console.log(
        `[head] ${key}: age=${ageSeconds.toFixed(
          1,
        )}s <= window=${CHECK_WINDOW_SECONDS}s -> WILL FETCH`,
      )
      return { key, lastModified }
    } else {
      console.log(
        `[head] ${key}: age=${ageSeconds.toFixed(
          1,
        )}s > window=${CHECK_WINDOW_SECONDS}s -> skip`,
      )
      return null
    }
  } catch (err) {
    if (err && err.name === "NotFound") {
      console.warn(`[head] ${key}: NotFound (404), skipping`)
      return null
    }
    console.error(`[head] error for key=${key}`, err)
    return null
  }
}

/**
 * Download a single object via GetObject and replace the local file.
 */
async function downloadObject(key) {
  console.log(`[get] downloading ${key}`)

  const res = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  )

  const localPath = localPathForKey(key)
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true })

  await pipeline(res.Body, fs.createWriteStream(localPath))

  console.log(`[get] wrote ${localPath}`)
}

// -------- MAIN --------

async function main() {
  console.log(
    `[sync] bucket=${BUCKET}, endpoint=${ENDPOINT}, prefix="${WATCH_PREFIX}", localRoot=${LOCAL_ROOT}`,
  )

  const explicitKeys = parseObjectKeysFromEnv()
  let keys

  if (explicitKeys && explicitKeys.length > 0) {
    // -------- STATIC LIST MODE (no ListObjectsV2) --------
    console.log(
      `[sync] STATIC LIST MODE: using R2_OBJECT_KEYS (${explicitKeys.length} keys)`,
    )
    keys = explicitKeys
  } else {
    // -------- AUTO LIST MODE (uses ListObjectsV2) --------
    console.log(
      `[sync] AUTO LIST MODE: listing all objects under prefix "${WATCH_PREFIX}"`,
    )
    keys = await listKeysWithPrefix()
    console.log(`[sync] found ${keys.length} objects under prefix`)
  }

  if (keys.length === 0) {
    console.log("[sync] no keys to check")
    return
  }

  // Ensure local root exists
  await fs.promises.mkdir(LOCAL_ROOT, { recursive: true })

  // HeadObject per key, then GetObject if within window
  for (const key of keys) {
    const info = await shouldFetchKey(key)
    if (!info) continue

    await downloadObject(key)
  }

  console.log("[sync] done")
}

main().catch(err => {
  console.error("[sync] fatal error", err)
  process.exit(1)
})
