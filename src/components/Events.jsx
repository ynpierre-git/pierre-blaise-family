import { useEffect, useState } from 'react'
import { eventsApi, uploadEventMedia, eventMediaApi } from '../api.js'
import LoginModal from './LoginModal.jsx'

const EMPTY = {
  title: '',
  date: '',
  location: '',
  host: '',
  description: '',
}

const MAX_MEDIA_MB = 500
const MAX_MEDIA_BYTES = MAX_MEDIA_MB * 1024 * 1024 // per-file cap (uploaded to Storage)

export default function Events({ authed = false, onLogin }) {
  const [eventList, setEventList] = useState(null) // null = loading
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [mediaNote, setMediaNote] = useState('')

  // Viewing is open to everyone; adding/editing requires the admin login. When a
  // logged-out visitor triggers an admin action we stash it and run it after a
  // successful sign-in.
  const [pendingAction, setPendingAction] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)

  // Lightbox: { media: [...], index } when a photo/video is opened full-size.
  const [lightbox, setLightbox] = useState(null)
  const openLightbox = (mediaArray, index) => setLightbox({ media: mediaArray, index })
  const closeLightbox = () => setLightbox(null)
  const stepLightbox = (delta) =>
    setLightbox((lb) => {
      if (!lb) return lb
      const n = lb.media.length
      return { ...lb, index: (lb.index + delta + n) % n }
    })

  const requireAuth = (action) => {
    if (authed) return action()
    setPendingAction(() => action)
    setLoginOpen(true)
  }

  const onLoginSuccess = () => {
    setLoginOpen(false)
    onLogin?.()
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
  }

  useEffect(() => {
    let live = true
    eventsApi
      .list()
      .then((data) => live && setEventList(data))
      .catch(() => {
        if (!live) return
        setEventList([])
        setLoadError('Could not load events. Make sure the server is running.')
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => e.key === 'Escape' && closeModal()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowRight') stepLightbox(1)
      else if (e.key === 'ArrowLeft') stepLightbox(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightbox])

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const openAdd = () => {
    setForm(EMPTY)
    setEditingId(null)
    setFormError('')
    setIsOpen(true)
  }

  const openEdit = (ev) => {
    setForm({
      title: ev.title,
      date: ev.date,
      location: ev.location || '',
      host: ev.host || '',
      description: ev.description || '',
    })
    setEditingId(ev.id)
    setFormError('')
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.date || saving) return
    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        const updated = await eventsApi.update(editingId, form)
        setEventList((list) => list.map((ev) => (ev.id === editingId ? updated : ev)))
      } else {
        const created = await eventsApi.create({ ...form, media: [] })
        setEventList((list) => [...list, created])
      }
      closeModal()
    } catch (err) {
      setFormError(err.message || 'Could not save. Is the server running?')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingId || saving) return
    setSaving(true)
    setFormError('')
    try {
      await eventsApi.remove(editingId)
      setEventList((list) => list.filter((ev) => ev.id !== editingId))
      closeModal()
    } catch (err) {
      setFormError(err.message || 'Could not delete.')
    } finally {
      setSaving(false)
    }
  }

  const addMedia = (eventId) => async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setMediaNote('Uploading…')

    const accepted = []
    const skipped = []
    let uploadError = ''
    for (const file of files) {
      if (file.size > MAX_MEDIA_BYTES) {
        skipped.push(file.name)
        continue
      }
      try {
        const { url, path } = await uploadEventMedia(file)
        accepted.push({
          id: `${Date.now()}-${file.name}`,
          type: file.type.startsWith('video') ? 'video' : 'image',
          url,
          path,
          name: file.name,
        })
      } catch (err) {
        uploadError = err.message || 'Upload failed.'
      }
    }

    if (accepted.length) {
      const ev = eventList.find((x) => x.id === eventId)
      const media = [...(ev.media || []), ...accepted]
      try {
        const updated = await eventsApi.update(eventId, { media })
        setEventList((list) => list.map((x) => (x.id === eventId ? updated : x)))
      } catch {
        setMediaNote('Uploaded, but could not save to the event.')
        return
      }
    }

    const notes = []
    if (uploadError) notes.push(uploadError)
    if (skipped.length)
      notes.push(`Skipped (over ${MAX_MEDIA_MB} MB): ${skipped.join(', ')}`)
    setMediaNote(notes.join(' '))
  }

  const removeMedia = async (eventId, mediaId) => {
    const ev = eventList.find((x) => x.id === eventId)
    const item = (ev.media || []).find((m) => m.id === mediaId)
    const media = (ev.media || []).filter((m) => m.id !== mediaId)
    try {
      const updated = await eventsApi.update(eventId, { media })
      setEventList((list) => list.map((x) => (x.id === eventId ? updated : x)))
      // Best-effort cleanup of the stored file (older inline items have no path).
      if (item?.path) eventMediaApi.deleteObject(item.path).catch(() => {})
    } catch {
      setMediaNote('Could not update media on the server.')
    }
  }

  const sorted =
    eventList === null ? [] : [...eventList].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <section className="section">
      <div className="section-head section-head-row">
        <div>
          <h2 className="section-title">Family Events</h2>
          <p className="section-sub">Gatherings, milestones, and moments to remember.</p>
        </div>
        <button
          type="button"
          className="btn-primary btn-add"
          onClick={() => requireAuth(openAdd)}
        >
          {authed ? '＋ Add Event' : '🔒 Add Event'}
        </button>
      </div>

      {loadError && <p className="bday-status is-error">{loadError}</p>}
      {mediaNote && <p className="bday-status is-warn">{mediaNote}</p>}

      {eventList === null ? (
        <p className="roster-loading">Loading events…</p>
      ) : sorted.length === 0 ? (
        <div className="card empty-state">
          <p className="empty-emoji" aria-hidden="true">📅</p>
          <p>No events yet. Add the first one!</p>
        </div>
      ) : (
        <ol className="timeline">
          {sorted.map((ev) => {
            const d = parseDate(ev.date)
            const media = ev.media || []
            return (
              <li key={ev.id} className="event-card card">
                <div className="event-date">
                  <span className="event-month">{d.month}</span>
                  <span className="event-day">{d.day}</span>
                  <span className="event-year">{d.year}</span>
                </div>
                <div className="event-body">
                  <div className="event-head">
                    <h3 className="event-title">{ev.title}</h3>
                    <button
                      type="button"
                      className="event-edit"
                      onClick={() => requireAuth(() => openEdit(ev))}
                      aria-label={`Edit ${ev.title}`}
                    >
                      {authed ? '✎ Edit' : '🔒 Edit'}
                    </button>
                  </div>
                  <p className="event-desc">{ev.description}</p>
                  <div className="event-meta">
                    {ev.location && <span className="meta-chip">📍 {ev.location}</span>}
                    {ev.host && <span className="meta-chip">✦ Hosted by {ev.host}</span>}
                  </div>

                  {media.length > 0 && (
                    <div className="media-gallery">
                      {media.map((m, idx) => (
                        <figure key={m.id} className="media-item">
                          <button
                            type="button"
                            className="media-open"
                            onClick={() => openLightbox(media, idx)}
                            aria-label={`View ${m.name || (m.type === 'video' ? 'video' : 'photo')} larger`}
                          >
                            {m.type === 'video' ? (
                              <video src={m.url} preload="metadata" muted playsInline />
                            ) : (
                              <img
                                src={sizedImage(m.url, 500)}
                                alt={m.name}
                                loading="lazy"
                              />
                            )}
                            <span className="media-zoom" aria-hidden="true">⤢</span>
                          </button>
                          {authed && (
                            <button
                              type="button"
                              className="media-remove"
                              aria-label={`Remove ${m.name}`}
                              onClick={() => removeMedia(ev.id, m.id)}
                            >
                              ×
                            </button>
                          )}
                          {m.type === 'video' && (
                            <span className="media-badge">▶ Video</span>
                          )}
                        </figure>
                      ))}
                    </div>
                  )}

                  {authed ? (
                    <label className="media-add">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={addMedia(ev.id)}
                        hidden
                      />
                      <span>＋ Add photos / videos</span>
                    </label>
                  ) : (
                    media.length === 0 && (
                      <button
                        type="button"
                        className="media-add"
                        onClick={() => requireAuth(() => {})}
                      >
                        <span>🔒 Sign in to add photos / videos</span>
                      </button>
                    )
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {isOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Event details">
            <div className="modal-head">
              <h3 className="form-title">{editingId ? 'Edit Event' : 'Add an Event'}</h3>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form className="modal-body" onSubmit={handleSubmit}>
              <label className="field">
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={update('title')}
                  placeholder="e.g. Annual Family Reunion"
                  autoFocus
                  required
                />
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Date</span>
                  <input type="date" value={form.date} onChange={update('date')} required />
                </label>
                <label className="field">
                  <span>Host</span>
                  <input
                    value={form.host}
                    onChange={update('host')}
                    placeholder="e.g. Naomie Pierre-Blaise"
                  />
                </label>
              </div>

              <label className="field">
                <span>Location</span>
                <input
                  value={form.location}
                  onChange={update('location')}
                  placeholder="e.g. Orlando, Florida"
                />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={update('description')}
                  placeholder="What's the occasion?"
                />
              </label>

              {formError && <p className="bday-status is-error">{formError}</p>}

              <div className="modal-actions">
                {editingId && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    Delete
                  </button>
                )}
                <span className="modal-actions-spacer" />
                <button type="button" className="btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loginOpen && (
        <LoginModal
          title="🔒 Sign in to manage events"
          onSuccess={onLoginSuccess}
          onCancel={() => {
            setLoginOpen(false)
            setPendingAction(null)
          }}
        />
      )}

      {lightbox && (
        <Lightbox
          item={lightbox.media[lightbox.index]}
          count={lightbox.media.length}
          index={lightbox.index}
          onPrev={() => stepLightbox(-1)}
          onNext={() => stepLightbox(1)}
          onClose={closeLightbox}
        />
      )}
    </section>
  )
}

function Lightbox({ item, count, index, onPrev, onNext, onClose }) {
  const multiple = count > 1
  return (
    <div
      className="lightbox-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <button type="button" className="lightbox-close" aria-label="Close" onClick={onClose}>
        ×
      </button>

      {multiple && (
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          aria-label="Previous"
          onClick={onPrev}
        >
          ‹
        </button>
      )}

      <figure className="lightbox-figure">
        {item.type === 'video' ? (
          <video src={item.url} controls autoPlay playsInline />
        ) : (
          <img src={sizedImage(item.url, 1600, 80)} alt={item.name || ''} />
        )}
        {(item.name || multiple) && (
          <figcaption className="lightbox-caption">
            {item.name}
            {multiple && <span className="lightbox-counter">{index + 1} / {count}</span>}
          </figcaption>
        )}
      </figure>

      {multiple && (
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          aria-label="Next"
          onClick={onNext}
        >
          ›
        </button>
      )}
    </div>
  )
}

function parseDate(iso) {
  const [year, month, day] = iso.split('-')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return { month: months[Number(month) - 1], day: Number(day), year }
}

// Photos are stored at full resolution (often many MB). Supabase Storage can
// resize on the fly via its image-render endpoint, so we request a small version
// for thumbnails and a medium one for the lightbox instead of the originals.
// Only applies to public Storage image URLs; base64/other URLs pass through.
function sizedImage(url, width, quality = 72) {
  if (!url || !url.includes('/storage/v1/object/public/')) return url
  const rendered = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  )
  return `${rendered}?width=${width}&quality=${quality}`
}
