import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import LoginModal from './LoginModal.jsx'
import { membersApi } from '../api.js'
import { getToken } from '../auth.js'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const API = import.meta.env.VITE_API_URL || ''

export default function Birthdays({ authed = false, onLogin }) {
  const now = new Date()
  const currentMonth = now.getMonth() // 0-indexed
  const monthName = MONTHS[currentMonth]
  const [members, setMembers] = useState(null) // null = loading
  const [status, setStatus] = useState(null) // { type, text }
  const [sending, setSending] = useState(false)
  const [pending, setPending] = useState(null) // recipients awaiting sign-in

  useEffect(() => {
    let live = true
    membersApi
      .list()
      .then((data) => live && setMembers(data))
      .catch(() => live && setMembers([]))
    return () => {
      live = false
    }
  }, [])

  const birthdaysThisMonth = (members || [])
    .filter((m) => m.birthday && Number(m.birthday.split('-')[1]) - 1 === currentMonth)
    .sort((a, b) => Number(a.birthday.split('-')[2]) - Number(b.birthday.split('-')[2]))

  const withEmail = birthdaysThisMonth.filter((m) => hasEmail(m))

  // Sending birthday emails is an admin action — sign in first if needed.
  const requestSend = (recipients) => {
    if (!recipients.length || sending) return
    if (authed) return send(recipients)
    setPending(recipients)
  }

  const send = async (members) => {
    if (!members.length || sending) return
    setSending(true)
    setStatus(null)
    const recipients = members.map((m) => ({
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      birthday: m.birthday,
    }))
    try {
      const token = getToken()
      const res = await fetch(`${API}/api/notify-birthdays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ recipients, month: monthName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ type: 'error', text: data.error || 'The server rejected the request.' })
        return
      }
      const n = data.sent?.length || 0
      const f = data.failed?.length || 0
      if (data.simulated) {
        setStatus({
          type: 'warn',
          text: `Simulated ${n} birthday ${n === 1 ? 'email' : 'emails'} — no API key set on the server yet, so nothing was actually delivered. Add RESEND_API_KEY to send for real.`,
        })
      } else if (f === 0) {
        setStatus({
          type: 'success',
          text: `Sent ${n} birthday ${n === 1 ? 'email' : 'emails'}. 🎉`,
        })
      } else {
        setStatus({
          type: 'warn',
          text: `Sent ${n}, but ${f} failed (${data.failed.map((x) => x.firstName).join(', ')}).`,
        })
      }
    } catch {
      setStatus({
        type: 'error',
        text: 'Could not reach the email server. Start it with “npm start” in the server/ folder.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="section">
      <div className="section-head section-head-center">
        <h2 className="section-title">Birthdays in {monthName}</h2>
        <p className="section-sub">Celebrating the family this month.</p>
        {birthdaysThisMonth.length > 0 && (
          <button
            type="button"
            className="btn-primary btn-add"
            onClick={() => requestSend(withEmail)}
            disabled={!withEmail.length || sending}
            title={
              withEmail.length
                ? 'Email everyone with an address on file'
                : 'No one this month has an email on file'
            }
          >
            {sending ? 'Sending…' : authed ? '✉ Send Birthday Wishes' : '🔒 Send Birthday Wishes'}
          </button>
        )}
      </div>

      {birthdaysThisMonth.length > 0 && (
        <p className="bday-note">
          {withEmail.length} of {birthdaysThisMonth.length}{' '}
          {birthdaysThisMonth.length === 1 ? 'celebrant has' : 'celebrants have'} an email
          on file.
        </p>
      )}
      {status && <p className={`bday-status is-${status.type}`}>{status.text}</p>}

      {members === null ? (
        <p className="roster-loading">Loading…</p>
      ) : birthdaysThisMonth.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-emoji" aria-hidden="true">🎈</p>
          <p>No birthdays in {monthName}. Check back next month!</p>
        </div>
      ) : (
        <ul className="bday-list">
          {birthdaysThisMonth.map((m) => (
            <li key={m.id} className="bday-card card">
              <Avatar member={m} className="avatar avatar-lg" />
              <div className="bday-info">
                <p className="bday-name">
                  {m.firstName} {m.lastName}
                </p>
                <p className="bday-date">🎂 {formatBirthday(m.birthday)}</p>
                {hasEmail(m) ? (
                  <button
                    type="button"
                    className="bday-notify"
                    onClick={() => requestSend([m])}
                    disabled={sending}
                  >
                    {authed ? '✉ Notify' : '🔒 Notify'}
                  </button>
                ) : (
                  <span className="bday-noemail">No email on file</span>
                )}
              </div>
              <div className="bday-day">{Number(m.birthday.split('-')[2])}</div>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <LoginModal
          title="🔒 Sign in to send birthday emails"
          onSuccess={() => {
            onLogin?.()
            const recipients = pending
            setPending(null)
            send(recipients)
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  )
}

function hasEmail(m) {
  return Boolean(m.email && m.email.trim())
}

function formatBirthday(iso) {
  const [, month, day] = iso.split('-')
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`
}
