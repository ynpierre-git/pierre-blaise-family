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
  res.json({
    ok: true,
    emailConfigured: Boolean(resend),
    smsConfigured: smsConfigured(),
  })
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

// ── Event media: direct-to-Storage uploads ──
// The browser asks for a signed URL, uploads the file straight to Supabase
// Storage (no serverless size cap), then saves the returned URL on the event.
app.post('/api/event-media/upload-url', wrap(async (req, res) =>
  res.json(await db.createMediaUploadUrl((req.body || {}).name)),
))
app.post('/api/event-media/delete', wrap(async (req, res) => {
  await db.removeMediaObject((req.body || {}).path)
  res.json({ ok: true })
}))

// ── Singleton content (Jean-Marie Pierre tribute, etc.) ──
app.get('/api/content/:key', wrap(async (req, res) =>
  res.json(await db.getContent(req.params.key)),
))
app.put('/api/content/:key', wrap(async (req, res) =>
  res.json(await db.setContent(req.params.key, req.body || {})),
))
app.delete('/api/content/:key', wrap(async (req, res) => {
  const ok = await db.removeContent(req.params.key)
  return ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' })
}))

// ── Broadcast an event announcement by email and/or SMS to all members ──
app.post('/api/broadcast-event', wrap(async (req, res) => {
  const { event = {}, message = '', channels = {} } = req.body || {}
  if (!channels.email && !channels.sms) {
    return res.status(400).json({ error: 'Pick at least one channel (email or SMS).' })
  }
  const members = await db.listMembers()
  const out = {}
  if (channels.email) out.email = await broadcastEmail(members.filter((m) => m.email), event, message)
  if (channels.sms) out.sms = await broadcastSms(members.filter((m) => m.phone), event, message)
  res.json(out)
}))

async function broadcastEmail(recipients, event, message) {
  if (!recipients.length) {
    return { ok: true, simulated: !resend, sent: 0, failed: 0, note: 'No members have an email address.' }
  }
  const { subject, text, html } = eventEmail(event, message)
  if (!resend) {
    return { ok: true, simulated: true, sent: recipients.length, failed: 0 }
  }
  const results = await Promise.allSettled(
    recipients.map((r) => resend.emails.send({ from: FROM, to: [r.email], subject, text, html })),
  )
  let sent = 0
  const errors = []
  results.forEach((r, i) => {
    const providerError = r.value?.error
    if (r.status === 'fulfilled' && !providerError) sent++
    else errors.push(`${recipients[i].email}: ${r.reason?.message || providerError?.message || 'failed'}`)
  })
  return { ok: errors.length === 0, simulated: false, sent, failed: errors.length, errors }
}

async function broadcastSms(recipients, event, message) {
  const client = await getTwilio()
  if (!recipients.length) {
    return { ok: true, simulated: !client, sent: 0, failed: 0, note: 'No members have a phone number.' }
  }
  const body = eventSmsText(event, message)
  if (!client) {
    return { ok: true, simulated: true, sent: recipients.length, failed: 0, note: 'SMS not configured — set TWILIO_* env vars to send for real.' }
  }
  const from = process.env.TWILIO_FROM_NUMBER
  const results = await Promise.allSettled(
    recipients.map((r) => client.messages.create({ from, to: r.phone, body })),
  )
  let sent = 0
  const errors = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sent++
    else errors.push(`${recipients[i].phone}: ${r.reason?.message || 'failed'}`)
  })
  return { ok: errors.length === 0, simulated: false, sent, failed: errors.length, errors }
}

// Twilio is optional and lazily loaded so the app runs fine without it.
let twilioClient = null
let twilioTried = false
function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  )
}
async function getTwilio() {
  if (twilioTried) return twilioClient
  twilioTried = true
  if (!smsConfigured()) return null
  try {
    const { default: twilio } = await import('twilio')
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  } catch (err) {
    console.error('Twilio unavailable:', err.message)
    twilioClient = null
  }
  return twilioClient
}

function eventDetailsLines(event) {
  const lines = []
  if (event.date) lines.push(`When: ${formatEventDate(event.date)}`)
  if (event.location) lines.push(`Where: ${event.location}`)
  if (event.host) lines.push(`Host: ${event.host}`)
  return lines
}

function eventSmsText(event, message) {
  const parts = []
  if (message.trim()) parts.push(message.trim())
  parts.push(`📣 ${event.title || 'Family Event'}`)
  parts.push(...eventDetailsLines(event))
  parts.push('— The Pierre-Blaise Family')
  return parts.join('\n')
}

function eventEmail(event, message) {
  const title = event.title || 'Family Event'
  const subject = `📣 ${title}`
  const details = eventDetailsLines(event)
  const text =
    (message.trim() ? `${message.trim()}\n\n` : '') +
    `${title}\n${details.join('\n')}\n\nWith love,\nThe Pierre-Blaise Family`
  const detailRows = details
    .map(
      (d) =>
        `<p style="margin:2px 0;font-size:15px;color:#2b2620;"><strong>${escapeHtml(d.split(':')[0])}:</strong>${escapeHtml(d.slice(d.indexOf(':') + 1))}</p>`,
    )
    .join('')
  const html = `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 540px; margin: 0 auto; background:#f3ead8; color:#2b2620; padding:32px; border-radius:14px; border:1px solid #cdbf9f;">
    <p style="font-size:12px; letter-spacing:3px; text-transform:uppercase; color:#bd7333; margin:0 0 8px;">Pierre-Blaise Family</p>
    <h1 style="font-size:24px; color:#2f4a3c; margin:0 0 16px;">📣 ${escapeHtml(title)}</h1>
    ${message.trim() ? `<p style="font-size:16px; line-height:1.6; margin:0 0 16px; white-space:pre-line;">${escapeHtml(message.trim())}</p>` : ''}
    <div style="background:#fbf6ec;border:1px solid #cdbf9f;border-radius:10px;padding:14px 18px;margin:8px 0 20px;">${detailRows}</div>
    <p style="font-size:16px; line-height:1.6; margin:0;">With love,<br/>The Pierre-Blaise Family</p>
  </div>`
  return { subject, text, html }
}

function formatEventDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) return iso || ''
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

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
