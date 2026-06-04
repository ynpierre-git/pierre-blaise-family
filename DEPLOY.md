# Deploying to pierreblaisefamily.com (Vercel)

This app is deployed as **one Vercel project**:
- the **frontend** (Vite/React) is served as static files, and
- the **backend** (Express) runs as a serverless function at `/api/*`
  (`api/index.js` → `server/app.js`).

Because both share the same domain, the browser calls relative `/api/...`
paths — no CORS, and the Supabase **service-role key stays on the server**.

---

## One-time setup

### 1. Put the code on GitHub
From the project root:

```bash
git init
git add .
git commit -m "Family tree app, ready for Vercel"
```

Create an empty repo at https://github.com/new (e.g. `pierre-blaise-family`),
then:

```bash
git branch -M main
git remote add origin https://github.com/<you>/pierre-blaise-family.git
git push -u origin main
```

> `.gitignore` already excludes `.env`, `server/.env`, and `.env.local`, so no
> secrets are committed. Double-check `git status` shows none of them.

### 2. Import the project into Vercel
1. Go to https://vercel.com → **Add New… → Project** → import the GitHub repo.
2. Framework preset: **Vite** (auto-detected). Leave build settings as-is —
   `vercel.json` already sets build = `npm run build`, output = `dist`.
3. **Before deploying**, add Environment Variables (Settings → Environment
   Variables) — these replace `server/.env` in production:

   | Name                        | Value                                   |
   |-----------------------------|-----------------------------------------|
   | `SUPABASE_URL`              | `https://nxyeqjyxwzaveltsyszx.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | your `sb_secret_…` key (server-side only) |
   | `VITE_SUPABASE_URL`         | same as `SUPABASE_URL` (browser-safe)   |
   | `VITE_SUPABASE_ANON_KEY`    | your `sb_publishable_…` / anon key (browser-safe) |
   | `RESEND_API_KEY`            | (optional — leave unset for simulated email) |
   | `FROM_EMAIL`                | (optional) `Pierre-Blaise Family <onboarding@resend.dev>` |

   The two `VITE_` Supabase vars are **build-time** values baked into the frontend
   so it can upload event photos/videos straight to Supabase Storage (bypassing
   the serverless request-size limit). They are browser-safe (the anon/publishable
   key is meant to be public; Storage access is gated by signed upload URLs).
   Without them, event-media uploads show a "storage not configured" message.

   Do **not** set `VITE_API_URL` — leaving it empty makes the frontend call the
   same-domain `/api`. Do **not** add the service-role key as a `VITE_` var.

4. Click **Deploy**. You'll get a `*.vercel.app` URL — test it (add a member,
   reload, confirm it persists in Supabase).

### 3. Connect the domain pierreblaisefamily.com
1. Vercel → Project → **Settings → Domains → Add** → `pierreblaisefamily.com`
   (add `www.pierreblaisefamily.com` too if you want it).
2. Vercel shows the DNS records to create. At your **domain registrar** (where
   you bought the domain), add them:
   - Apex `pierreblaisefamily.com` → **A** record `76.76.21.21`
     (use the exact value Vercel shows), **or** an ALIAS/ANAME to
     `cname.vercel-dns.com` if your registrar supports it.
   - `www` → **CNAME** → `cname.vercel-dns.com`.
3. Wait for DNS to propagate (minutes to a few hours). Vercel auto-issues the
   HTTPS certificate. Done — the site is live at https://pierreblaisefamily.com.

---

## Updating the site later
Just push to `main`:

```bash
git add -A && git commit -m "…" && git push
```

Vercel rebuilds and redeploys automatically.

---

## Known limitation: large photo uploads
Vercel serverless functions cap the **request body at ~4.5 MB**. This app stores
photos/media inline as base64 data URLs (which inflate ~33%), so a photo larger
than roughly 3 MB can fail to save with a 413 error. If that becomes a problem,
switch photo storage to **Supabase Storage** (upload the file, store only its
URL) instead of inline base64.
