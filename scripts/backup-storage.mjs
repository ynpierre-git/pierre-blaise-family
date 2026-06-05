// Storage backup — downloads every event photo/video from Supabase Storage
// (the public 'event-media' bucket) to a local folder, with a manifest.
//
//   node scripts/backup-storage.mjs
//
// Files are discovered from the database (each event's media[].path/url), so this
// captures everything currently in use. The downloaded files are saved under
// server/backups/storage/<date>/ (git-ignored — they're large binaries; keep
// them somewhere safe like a drive or cloud folder).
//
// To RESTORE these into a bucket later, re-upload each file to the SAME path it
// has in the manifest so the URLs stored in the database keep resolving.

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.SITE_URL || 'https://www.pierreblaisefamily.com'
const DATE = new Date().toISOString().slice(0, 10)
const DIR = resolve('server/backups/storage', DATE)
mkdirSync(DIR, { recursive: true })

const events = await (await fetch(`${BASE}/api/events`)).json()

// Collect unique media files referenced by events.
const seen = new Set()
const files = []
for (const ev of events) {
  for (const m of ev.media || []) {
    if (!m.url || seen.has(m.url)) continue
    seen.add(m.url)
    files.push({
      path: m.path || m.url.split('/object/public/event-media/')[1] || m.name,
      url: m.url,
      name: m.name || '',
      type: m.type || '',
      eventId: ev.id,
      eventTitle: ev.title || '',
    })
  }
}

console.log(`Found ${files.length} media file(s). Downloading to ${DIR}`)

const manifest = []
let totalBytes = 0
let ok = 0
let failed = 0
for (const [i, f] of files.entries()) {
  try {
    const res = await fetch(f.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const safe = f.path.replace(/[\\/]/g, '_')
    writeFileSync(resolve(DIR, safe), buf)
    totalBytes += buf.length
    ok++
    manifest.push({ ...f, file: safe, bytes: buf.length })
    console.log(`  [${i + 1}/${files.length}] ${safe} — ${(buf.length / 1024 / 1024).toFixed(2)} MB`)
  } catch (err) {
    failed++
    manifest.push({ ...f, error: err.message })
    console.log(`  [${i + 1}/${files.length}] FAILED ${f.path} — ${err.message}`)
  }
}

writeFileSync(
  resolve(DIR, 'manifest.json'),
  JSON.stringify({ generated: new Date().toISOString(), source: BASE, bucket: 'event-media', files: manifest }, null, 2),
)

console.log(
  `\nDone: ${ok} downloaded, ${failed} failed, ${(totalBytes / 1024 / 1024).toFixed(1)} MB total.`,
)
console.log(`Backup folder: ${DIR}`)
console.log(`Manifest: ${resolve(DIR, 'manifest.json')}`)
