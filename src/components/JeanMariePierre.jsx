import { useEffect, useState } from 'react'
import { contentApi, fileToDataUrl } from '../api.js'
import LoginModal from './LoginModal.jsx'

// The tribute is editable in-app and persisted in Supabase under this key.
const CONTENT_KEY = 'jeanmarie'
const MAX_PHOTO_BYTES = 3 * 1024 * 1024 // ~3 MB keeps the data URL under Vercel's request cap
const STATIC_PHOTO = '/jean-marie-pierre.jpg'

// Shown until something is saved to the database (and as the baseline for the
// editor). The photo falls back to the static file in public/ when empty.
const DEFAULTS = {
  lead:
    "With dedication, patience, and vision, Jean-Marie Pierre gathered and " +
    "preserved the story of our family — giving us a priceless gift that " +
    "strengthens our identity and keeps our legacy alive for generations to come.",
  upbringing:
    "Rooted in Arcahaie, Haïti 🇭🇹, Jean-Marie grew up surrounded by the values " +
    "that still shape our family today — faith, hard work, and a deep love of kin.",
  accolades:
    "Researched and assembled the Pierre-Blaise family tree across multiple generations.\n" +
    "Preserved photographs, names, and memories that might otherwise have been lost.\n" +
    "Brought the family together for our reunion through his tireless work.",
  photo: '',
}

export default function JeanMariePierre({ authed = false, onLogin }) {
  const [content, setContent] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [photoOk, setPhotoOk] = useState(true)
  const [editing, setEditing] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    let live = true
    contentApi
      .get(CONTENT_KEY)
      .then((data) => {
        if (live && data) setContent({ ...DEFAULTS, ...data })
      })
      .catch(() => {}) // fall back to defaults if the server/table isn't ready
      .finally(() => live && setLoaded(true))
    return () => {
      live = false
    }
  }, [])

  const startEdit = () => {
    if (authed) setEditing(true)
    else setLoginOpen(true)
  }

  const photoSrc = content.photo || STATIC_PHOTO
  const showPhoto = Boolean(content.photo) || photoOk
  const accolades = (content.accolades || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  if (editing) {
    return (
      <Editor
        initial={content}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          setContent({ ...DEFAULTS, ...saved })
          setPhotoOk(true)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <section className="section jmp">
      <div className="section-head section-head-row">
        <div>
          <h2 className="section-title">Jean-Marie Pierre</h2>
          <p className="section-sub">Keeper of our family's history</p>
        </div>
        <button type="button" className="btn-ghost" onClick={startEdit}>
          {authed ? '✎ Edit' : '🔒 Edit'}
        </button>
      </div>

      <div className="jmp-hero card">
        <div className="jmp-photo">
          {showPhoto ? (
            <img
              src={photoSrc}
              alt="Jean-Marie Pierre"
              loading="lazy"
              onError={() => setPhotoOk(false)}
            />
          ) : (
            <svg className="jmp-silhouette" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 12.5c2.07 0 3.75-1.68 3.75-3.75S14.07 5 12 5 8.25 6.68 8.25 8.75 9.93 12.5 12 12.5zm0 1.75c-2.92 0-7 1.47-7 4.38V20h14v-1.37c0-2.91-4.08-4.38-7-4.38z" />
            </svg>
          )}
        </div>
        <div className="jmp-intro">
          <p className="jmp-lead">{content.lead}</p>
        </div>
      </div>

      <div className="jmp-grid">
        <article className="card jmp-block">
          <h3 className="jmp-h3">🌱 His Upbringing</h3>
          {paragraphs(content.upbringing)}
        </article>

        <article className="card jmp-block">
          <h3 className="jmp-h3">🏅 Accolades &amp; Contributions</h3>
          {accolades.length > 0 ? (
            <ul className="jmp-list">
              {accolades.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="jmp-note">No accolades added yet.</p>
          )}
        </article>
      </div>

      {!loaded && <p className="roster-loading">Loading…</p>}

      {loginOpen && (
        <LoginModal
          title="🔒 Sign in to edit this page"
          onSuccess={() => {
            setLoginOpen(false)
            onLogin?.()
            setEditing(true)
          }}
          onCancel={() => setLoginOpen(false)}
        />
      )}
    </section>
  )
}

function Editor({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Photo is too large (max ~3 MB). Please choose a smaller image.')
      return
    }
    setError('')
    const url = await fileToDataUrl(file)
    setForm((f) => ({ ...f, photo: url }))
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const saved = await contentApi.save(CONTENT_KEY, form)
      onSaved(saved || form)
    } catch (err) {
      setError(
        err.message ||
          'Could not save. If this is the first save, make sure the `content` table exists in Supabase.',
      )
    } finally {
      setSaving(false)
    }
  }

  const preview = form.photo || STATIC_PHOTO

  return (
    <section className="section jmp">
      <div className="section-head">
        <h2 className="section-title">Edit — Jean-Marie Pierre</h2>
        <p className="section-sub">Update his photo and story. Saved for everyone.</p>
      </div>

      <div className="card jmp-block">
        <div className="jmp-edit-photo">
          <div className="jmp-photo">
            <img src={preview} alt="" loading="lazy" />
          </div>
          <div>
            <label className="media-add">
              <input type="file" accept="image/*" onChange={onPhoto} hidden />
              <span>＋ Choose photo</span>
            </label>
            {form.photo && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setForm((f) => ({ ...f, photo: '' }))}
              >
                Remove uploaded photo
              </button>
            )}
            <p className="jmp-note">JPG or PNG, up to ~3 MB.</p>
          </div>
        </div>

        <label className="field">
          <span>Dedication (intro)</span>
          <textarea rows="3" value={form.lead} onChange={update('lead')} />
        </label>

        <label className="field">
          <span>His upbringing</span>
          <textarea rows="5" value={form.upbringing} onChange={update('upbringing')} />
        </label>

        <label className="field">
          <span>Accolades &amp; contributions (one per line)</span>
          <textarea rows="5" value={form.accolades} onChange={update('accolades')} />
        </label>

        {error && <p className="bday-status is-error">{error}</p>}

        <div className="modal-actions">
          <span className="modal-actions-spacer" />
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </section>
  )
}

// Render a multi-line string as separate paragraphs (blank line = new paragraph).
function paragraphs(text = '') {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>)
}
