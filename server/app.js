import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { Resend } from 'resend'
import { db } from './db.js'

const app = express()
app.use(cors())
// Large limit so data-URL photos / media can be saved.
app.use(express.json({ limit: '25mb' }))

const FROM = process.env.FROM_EMAIL || 'Pierre-Blaise Family <onboarding@resend.dev>'
const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null

app.get('/api/health', (req, res) => {
  res.json({ ok: true, emailConfigured: Boolean(resend) })
})

// Wrap async route handlers so a thrown DB error becomes a 500 instead of
// crashing the process / hanging the request.
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err)
    res.status(500).json({ error: err.message || 'Server error' })
  })

// ── Members CRUD ──
app.get('/api/members', wrap(async (req, res) => res.json(await db.listMembers())))
app.post('/api/members', wrap(async (req, res) => res.status(201).json(await db.addMember(req.body || {}))))
app.put('/api/members/:id', wrap(async (req, res) => {
  const updated = await db.updateMember(req.params.id, req.body || {})
  return updated ? res.json(updated) : res.status(404).json({ error: 'Member not found' })
}))
app.delete('/api/members/:id', wrap(async (req, res) => {
  const { id } = req.params
  const members = await db.listMembers()
  const target = members.find((m) => String(m.id) === String(id))
  if (!target) return res.status(404).json({ error: 'Member not found' })

  // Block deletion if this person is listed as a parent of anyone.
  const children = members.filter(
    (m) => String(m.fatherId) === String(id) || String(m.motherId) === String(id),
  )
  if (children.length) {
    const names = children.map((c) => `${c.firstName} ${c.lastName}`.trim()).join(', ')
    return res.status(409).json({
      error:
        `Cannot delete ${target.firstName} ${target.lastName} — listed as a parent of ` +
        `${children.length} ${children.length === 1 ? 'person' : 'people'} (${names}). ` +
        `Remove or reassign those records first.`,
    })
  }

  await db.removeMember(id)
  res.json({ ok: true })
}))

// ── Events CRUD ──
app.get('/api/events', wrap(async (req, res) => res.json(await db.listEvents())))
app.post('/api/events', wrap(async (req, res) => res.status(201).json(await db.addEvent(req.body || {}))))
app.put('/api/events/:id', wrap(async (req, res) => {
  const updated = await db.updateEvent(req.params.id, req.body || {})
  return updated ? res.json(updated) : res.status(404).json({ error: 'Event not found' })
}))
app.delete('/api/events/:id', wrap(async (req, res) => {
  const ok = await db.removeEvent(req.params.id)
  return ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Event not found' })
}))

// ── Singleton content (Jean-Marie Pierre tribute, etc.) ──
app.get('/api/content/:key', wrap(async (req, res) =>
  res.json(await db.getContent(req.params.key)),
))
app.put('/api/content/:key', wrap(async (req, res) =>
  res.json(await db.setContent(req.params.key, req.body || {})),
))

// Sends a birthday email to every provided recipient that has an address.
app.post('/api/notify-birthdays', async (req, res) => {
  const { recipients = [], month = '' } = req.body || {}
  const valid = recipients.filter((r) => r && r.email && r.firstName)

  if (!valid.length) {
    return res
      .status(400)
      .json({ ok: false, error: 'No recipients with an email address were provided.' })
  }

  // Simulated mode (no API key) — lets you test the flow without sending.
  if (!resend) {
    return res.json({
      ok: true,
      simulated: true,
      sent: valid.map((r) => ({ email: r.email, firstName: r.firstName, status: 'simulated' })),
      failed: [],
    })
  }

  const results = await Promise.allSettled(
    valid.map((r) => {
      const { subject, text, html } = birthdayEmail(r, month)
      return resend.emails.send({ from: FROM, to: [r.email], subject, text, html })
    }),
  )

  const sent = []
  const failed = []
  results.forEach((result, i) => {
    const r = valid[i]
    const providerError = result.value?.error
    if (result.status === 'fulfilled' && !providerError) {
      sent.push({ email: r.email, firstName: r.firstName, status: 'sent' })
    } else {
      const error =
        result.reason?.message || providerError?.message || 'Unknown sending error'
      failed.push({ email: r.email, firstName: r.firstName, error })
    }
  })

  res.json({ ok: failed.length === 0, simulated: false, sent, failed })
})

function birthdayEmail(person, monthName) {
  const name = person.firstName
  const subject = `Happy Birthday, ${name}! 🎂`
  const text =
    `Happy Birthday, ${name}!\n\n` +
    `Wishing you a joyful day and a wonderful year ahead, ` +
    `from all of us in the Pierre-Blaise family.\n\n` +
    `With love,\nThe Pierre-Blaise Family`
  const html = `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 520px; margin: 0 auto; background:#f3ead8; color:#2b2620; padding:32px; border-radius:14px; border:1px solid #cdbf9f;">
    <p style="font-size:12px; letter-spacing:3px; text-transform:uppercase; color:#bd7333; margin:0 0 8px;">Pierre-Blaise Family${monthName ? ` · ${escapeHtml(monthName)}` : ''}</p>
    <h1 style="font-size:26px; color:#2f4a3c; margin:0 0 16px;">Happy Birthday, ${escapeHtml(name)}! 🎂</h1>
    <p style="font-size:16px; line-height:1.6; margin:0 0 16px;">
      Wishing you a joyful day and a wonderful year ahead, from all of us in the
      <strong>Pierre-Blaise family</strong>.
    </p>
    <p style="font-size:16px; line-height:1.6; margin:24px 0 0;">With love,<br/>The Pierre-Blaise Family</p>
  </div>`
  return { subject, text, html }
}

function escapeHtml(s = '') {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  )
}

export default app
