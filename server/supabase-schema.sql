-- Pierre-Blaise Family Tree — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run.
--
-- Design note: members/events carry a flexible set of fields (relationship
-- ids, photos as data URLs, an events `media` array, fields the form may add
-- later). To preserve that shape exactly and avoid lock-step column changes,
-- each row stores its app object in a JSONB `data` column. The backend
-- flattens rows to { id, ...data } so the API shape is unchanged.

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Newest-first members, oldest-first events — matches the old in-memory order.
create index if not exists members_created_at_idx on public.members (created_at desc);
create index if not exists events_created_at_idx  on public.events  (created_at asc);

-- Enable Row Level Security with NO policies. This denies all access to the
-- anon/publishable key, so the browser can never read or write these tables
-- directly. The Express backend uses the SERVICE ROLE key, which bypasses RLS
-- entirely — all data access goes through the API, exactly as before.
alter table public.members enable row level security;
alter table public.events  enable row level security;
