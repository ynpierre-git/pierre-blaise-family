# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Pierre-Blaise Family Tree" — a private family web app: a Vite + React 18 frontend plus a small Express backend that persists data and sends birthday emails. There is no test framework and no linter configured.

## Commands

Two separate Node packages. The backend must be running for the app to load data.

```bash
# Backend (run first) — from server/
cd server
npm install
npm start          # node index.js, listens on :3001
npm run dev        # same with --watch (auto-restart)

# Frontend — from the project root
npm install
npm run dev        # Vite dev server on :5173
npm run build      # production build to dist/
npm run preview    # serve the built bundle
```

Start order in development: **backend (3001) first, then `npm run dev` (5173)**. The Vite dev server proxies `/api` → `http://localhost:3001` (see `vite.config.js`), so the frontend calls relative `/api/...` paths and there is no CORS setup in dev.

Environment: Windows + PowerShell. `.env` files exist but are placeholders — Supabase is **not** wired up yet (see "Persistence" below).

## Architecture

### Frontend (`src/`)
Single-page app. `App.jsx` owns the active-tab state and renders one of four tabs: **Demographics** (admin), **Family Tree**, **Events**, **Birthdays**. The app intentionally lands on the `tree` tab so visitors see content, not the login.

- `src/api.js` — the only thing that talks to the backend. `membersApi` / `eventsApi` (CRUD) and `fileToDataUrl`. Base URL is `import.meta.env.VITE_API_URL || ''` (empty → use the Vite proxy).
- `src/auth.js` — token-based admin auth. `login(password)` POSTs to `/api/login`, which verifies the password server-side against a **bcrypt hash** (env var `ADMIN_PASSWORD_HASH`) and returns a signed session token; the token lives in `sessionStorage` and is sent as `Authorization: Bearer …` on every write (see `src/api.js`). **Reads are public; all mutations are enforced on the server** by `requireAuth` (`server/auth.js`). Required env vars: `ADMIN_PASSWORD_HASH` + `AUTH_SECRET` (generate both with `node server/scripts/make-admin-credentials.mjs "<pw>"`); if unset the server fails closed (login + writes → 503). No username, no in-app password change — the password *is* the env-var hash.
- `src/components/Avatar.jsx` — renders a person's photo, or a silhouette SVG fallback when there's no photo.
- `src/data/placeholder.js` — now essentially empty (`familyTree = null`); the tree is built from the database, not this file.

### Backend (`server/`)
Express API (`index.js`) over a **JSON-file database** — no external DB, no native deps.

- `server/db.js` — loads/saves `server/pbfam.db.json`, rewriting the whole file on each mutation. Seeded from `server/seed.js` (currently **empty** — the app starts with no people).
- Routes: CRUD at `/api/members` and `/api/events`; `POST /api/notify-birthdays` sends emails via Resend.
- `express.json({ limit: '25mb' })` is deliberate: photos and event media are stored inline as **base64 data URLs**, so payloads are large.

### Data model & the family tree
Member records carry relationship fields: `maritalStatus`, `spouseId`, `fatherId`, `motherId` (the `*Id` fields reference other members' ids). Events hold a `media` array of `{ id, type, url, name }`.

`FamilyTree.jsx` is the most non-obvious piece: `buildForest()` turns the **flat** member list into a nested couple/child tree. Couples form from `spouseId` links plus inferred co-parents (two people who are a child's father+mother); children nest under their parents' couple; a couple is anchored on the partner who has parents in the data (so married-in spouses sit beside them); unconnected people and separate families render as multiple roots; there is a cycle guard against bad relationship loops. The tree is recomputed from the DB on each mount (and a Refresh button) — it does not auto-update while you edit on another tab.

### Email
`POST /api/notify-birthdays` uses Resend. Without `RESEND_API_KEY` it runs in **simulated mode** (returns success but sends nothing); the Birthdays tab surfaces this so it's never misleading. The frontend computes "birthdays this month, with an email" and posts those recipients.

## Business rules to preserve
- **A member who is listed as someone's parent cannot be deleted.** Enforced server-side (`DELETE /api/members/:id` returns 409) and mirrored in the UI (Delete disabled with a note).
- **Marital status Married/Partnered requires a spouse** (`spouseId`) — validated in the Demographics form before save.
- **Spouse links are one-directional** — setting it on one partner is enough for the tree to pair them, but it is not auto-written to the other record.

## Persistence / Supabase status
Data currently lives in `server/pbfam.db.json` (git-ignored). `server/.env` and `.env.local` contain **placeholder** Supabase + Resend variables but nothing reads the Supabase ones yet. Migrating to Supabase means: add a Postgres/`@supabase/supabase-js` client, create `members`/`events` tables, and swap the implementation inside `server/db.js` (keep its function signatures so routes don't change). Keep the service-role key / `DATABASE_URL` server-side only; only `VITE_`-prefixed vars may reach the browser.
