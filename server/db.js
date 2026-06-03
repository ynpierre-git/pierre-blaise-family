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
  listEvents: () => listFrom('events', true),
  addEvent: (e) => {
    const payload = toData(e)
    if (!Array.isArray(payload.media)) payload.media = []
    return insertInto('events', payload)
  },
  updateEvent: (id, patch) => patchIn('events', id, patch),
  removeEvent: (id) => removeFrom('events', id),
}
