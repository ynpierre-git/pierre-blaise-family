// Supabase-backed data store. Same function names/return shapes as before,
// but every method is now async (the routes in index.js await them).
//
// Rows live as { id, data, created_at }; `data` is a JSONB blob holding the
// whole app object (firstName, relationship ids, photos, events `media`, ...).
// We flatten to { id, ...data } on the way out so the API shape is unchanged.
// See server/supabase-schema.sql for the tables.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  throw new Error(
    'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env',
  )
}

// Service role key bypasses RLS — server-side only, never sent to the browser.
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Row <-> app-object helpers.
const flatten = (row) => (row ? { id: row.id, ...row.data } : null)
const toData = (obj = {}) => {
  const { id, ...rest } = obj // id is owned by the DB, never stored inside data
  return rest
}

async function listFrom(table, ascending) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending })
  if (error) throw error
  return data.map(flatten)
}

async function insertInto(table, payload) {
  const { data, error } = await supabase
    .from(table)
    .insert({ data: payload })
    .select()
    .single()
  if (error) throw error
  return flatten(data)
}

// Shallow-merge a patch into an existing row's data ({ ...existing, ...patch }),
// returning the updated record or null if the id doesn't exist.
async function patchIn(table, id, patch) {
  const { data: existing, error: readErr } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (readErr) throw readErr
  if (!existing) return null

  const merged = { ...existing.data, ...toData(patch) }
  const { data, error } = await supabase
    .from(table)
    .update({ data: merged })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return flatten(data)
}

async function removeFrom(table, id) {
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
  if (error) throw error
  return data.length > 0
}

export const db = {
  // ── Members ── (newest first, matching the old unshift behavior)
  listMembers: () => listFrom('members', false),
  addMember: (m) => insertInto('members', toData(m)),
  updateMember: (id, patch) => patchIn('members', id, patch),
  removeMember: (id) => removeFrom('members', id),

  // ── Events ── (oldest first, matching the old push behavior)
  // Singleton content rows live in this same table marked with `_contentKey`;
  // filter them out so they never appear as events.
  listEvents: async () =>
    (await listFrom('events', true)).filter((e) => !e[CONTENT_MARKER]),
  addEvent: (e) => {
    const payload = toData(e)
    if (!Array.isArray(payload.media)) payload.media = []
    return insertInto('events', payload)
  },
  updateEvent: (id, patch) => patchIn('events', id, patch),
  removeEvent: (id) => removeFrom('events', id),

  // ── Event media files (Supabase Storage) ──
  // The browser uploads files straight to Storage via a signed URL, so large
  // photos/videos skip the serverless request-size limit. Only the resulting
  // public URL + path is stored on the event row.
  createMediaUploadUrl: (name) => createMediaUploadUrl(name),
  removeMediaObject: (path) => removeMediaObject(path),

  // ── Singleton content (e.g. the Jean-Marie Pierre tribute) ──
  // Stored as a marked row in the `events` table so no extra table/migration is
  // needed. Returns the saved data object (without the marker), or null.
  getContent: (key) => getContentRow(key),
  setContent: (key, value) => upsertContentRow(key, value),
  removeContent: (key) => removeContentRow(key),
}

// Marks an events-table row as singleton content rather than a real event.
const CONTENT_MARKER = '_contentKey'

// ── Storage: event media ──
const MEDIA_BUCKET = 'event-media'
let bucketReady = false

// Create the public bucket once (idempotent) so there is no manual setup step.
async function ensureBucket() {
  if (bucketReady) return
  // No explicit fileSizeLimit: the bucket inherits the project's global storage
  // limit. (Setting one above the global limit makes createBucket fail.) Raise
  // the global limit in Supabase → Settings → Storage to allow larger videos.
  const { error } = await supabase.storage.createBucket(MEDIA_BUCKET, {
    public: true,
  })
  // "already exists" is fine; anything else is a real error.
  if (error && !/already exists/i.test(error.message || '')) throw error
  bucketReady = true
}

// Mint a one-time signed upload URL for a unique path, plus the public URL the
// file will have once uploaded.
async function createMediaUploadUrl(name) {
  await ensureBucket()
  const safe = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path)
  if (error) throw error
  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return { signedUrl: data.signedUrl, token: data.token, path, publicUrl: pub.publicUrl }
}

async function removeMediaObject(path) {
  if (!path) return false
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path])
  if (error) throw error
  return true
}

// Strip the marker before returning content to callers.
const unwrapContent = (row) => {
  if (!row?.data) return null
  const { [CONTENT_MARKER]: _omit, ...rest } = row.data
  return rest
}

async function findContentRow(key) {
  const { data, error } = await supabase
    .from('events')
    .select('id, data')
    .eq(`data->>${CONTENT_MARKER}`, key)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function getContentRow(key) {
  return unwrapContent(await findContentRow(key))
}

async function upsertContentRow(key, value) {
  const payload = { ...value, [CONTENT_MARKER]: key }
  const existing = await findContentRow(key)
  const query = existing
    ? supabase.from('events').update({ data: payload }).eq('id', existing.id)
    : supabase.from('events').insert({ data: payload })
  const { data, error } = await query.select('data').single()
  if (error) throw error
  return unwrapContent(data)
}

async function removeContentRow(key) {
  const existing = await findContentRow(key)
  if (!existing) return false
  const { error } = await supabase.from('events').delete().eq('id', existing.id)
  if (error) throw error
  return true
}
