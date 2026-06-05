import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'https://www.pierreblaisefamily.com'
const DATE = new Date().toISOString().slice(0, 10)
const OUT = `server/backups/restore-${DATE}.sql`

const j = (obj) => "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb"
const dataOf = (row) => {
  const { id, ...rest } = row
  return rest
}

const members = await (await fetch(`${BASE}/api/members`)).json()
const events = await (await fetch(`${BASE}/api/events`)).json()
const tribute = await (await fetch(`${BASE}/api/content/jeanmarie`)).json()

// members are returned newest-first; insert oldest-first so created_at order is
// preserved. events are returned oldest-first already.
const membersOldestFirst = [...members].reverse()

const lines = []
lines.push(`-- Pierre-Blaise Family Tree — database content restore`)
lines.push(`-- Generated ${DATE} from production (${BASE}).`)
lines.push(`-- Restores the members + events tables (including the hidden`)
lines.push(`-- Jean-Marie Pierre tribute content row) to this exact state.`)
lines.push(`--`)
lines.push(`-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste → Run.`)
lines.push(`-- This REPLACES all current rows in members + events with this snapshot.`)
lines.push(`--`)
lines.push(`-- NOTE: event photos/videos live in Supabase Storage (bucket 'event-media').`)
lines.push(`-- This script restores the database rows that reference those files, not the`)
lines.push(`-- files themselves. As long as the bucket still holds them, the URLs work.`)
lines.push('')
lines.push(`create extension if not exists "pgcrypto";`)
lines.push(`create table if not exists public.members (`)
lines.push(`  id uuid primary key default gen_random_uuid(),`)
lines.push(`  data jsonb not null default '{}'::jsonb,`)
lines.push(`  created_at timestamptz not null default now());`)
lines.push(`create table if not exists public.events (`)
lines.push(`  id uuid primary key default gen_random_uuid(),`)
lines.push(`  data jsonb not null default '{}'::jsonb,`)
lines.push(`  created_at timestamptz not null default now());`)
lines.push('')
lines.push('begin;')
lines.push('')
lines.push('-- Clear existing content, then re-insert this snapshot.')
lines.push('delete from public.events;')
lines.push('delete from public.members;')
lines.push('')

lines.push(`-- Members (${membersOldestFirst.length})`)
if (membersOldestFirst.length) {
  lines.push('insert into public.members (id, data) values')
  lines.push(
    membersOldestFirst
      .map((m) => `  ('${m.id}', ${j(dataOf(m))})`)
      .join(',\n') + ';',
  )
} else {
  lines.push('-- (none)')
}
lines.push('')

lines.push(`-- Events (${events.length})`)
if (events.length) {
  lines.push('insert into public.events (id, data) values')
  lines.push(events.map((e) => `  ('${e.id}', ${j(dataOf(e))})`).join(',\n') + ';')
} else {
  lines.push('-- (none)')
}
lines.push('')

lines.push(`-- Jean-Marie Pierre tribute (stored as a marked row in events)`)
if (tribute) {
  lines.push(
    `insert into public.events (data) values (${j({ ...tribute, _contentKey: 'jeanmarie' })});`,
  )
} else {
  lines.push('-- (no tribute content saved)')
}
lines.push('')
lines.push('commit;')
lines.push('')

mkdirSync('server/backups', { recursive: true })
writeFileSync(OUT, lines.join('\n'))
console.log('• wrote', OUT)
console.log('  members:', members.length, '| events:', events.length, '| tribute:', tribute ? 'yes' : 'no')
