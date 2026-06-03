import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import ChangeCredentials from './ChangeCredentials.jsx'
import { getCredentials } from '../auth.js'
import { membersApi, fileToDataUrl } from '../api.js'

const EMPTY = {
  firstName: '',
  lastName: 'Pierre-Blaise',
  birthday: '',
  gender: '',
  branch: '',
  city: '',
  country: '',
  email: '',
  photo: '',
  maritalStatus: '',
  spouseId: '',
  fatherId: '',
  motherId: '',
  notes: '',
}

const MARITAL_STATUSES = [
  'Single',
  'Engaged',
  'Married',
  'Partnered',
  'Separated',
  'Divorced',
  'Widowed',
]

// Statuses that require a "married / partnered to" person to be chosen.
const REQUIRES_SPOUSE = ['Married', 'Partnered']

export default function Demographics({ onLogout }) {
  const [members, setMembers] = useState(null) // null = loading
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [justAdded, setJustAdded] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showAccount, setShowAccount] = useState(false)
  const [username, setUsername] = useState(() => getCredentials().username)
  const [actionError, setActionError] = useState('')

  // Load records from the database.
  useEffect(() => {
    let live = true
    membersApi
      .list()
      .then((data) => live && setMembers(data))
      .catch(() => {
        if (!live) return
        setMembers([])
        setLoadError('Could not load records. Make sure the server is running.')
      })
    return () => {
      live = false
    }
  }, [])

  // Close the dialog on Escape, and lock background scroll while open.
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

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  // Marital status change — clear the spouse when set to single/none.
  const onMaritalChange = (e) => {
    const v = e.target.value
    setForm((f) => ({
      ...f,
      maritalStatus: v,
      spouseId: v === '' || v === 'Single' ? '' : f.spouseId,
    }))
  }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await fileToDataUrl(file)
    setForm((f) => ({ ...f, photo: url }))
    e.target.value = ''
  }

  const openModal = () => {
    setForm(EMPTY)
    setEditingId(null)
    setFormError('')
    setIsOpen(true)
  }

  const openEdit = (member) => {
    setForm({ ...EMPTY, ...member })
    setEditingId(member.id)
    setFormError('')
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.firstName.trim() || saving) return
    if (REQUIRES_SPOUSE.includes(form.maritalStatus) && !form.spouseId) {
      setFormError(
        `Please choose who this person is ${form.maritalStatus.toLowerCase()} to — the “Married / partnered to” field is required.`,
      )
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        const updated = await membersApi.update(editingId, form)
        setMembers((list) => list.map((m) => (m.id === editingId ? updated : m)))
        setJustAdded(editingId)
      } else {
        const created = await membersApi.create(form)
        setMembers((list) => [created, ...list])
        setJustAdded(created.id)
      }
      closeModal()
      setTimeout(() => setJustAdded(null), 2200)
    } catch (err) {
      setFormError(err.message || 'Could not save. Is the server running?')
    } finally {
      setSaving(false)
    }
  }

  // Quick photo update straight from a roster row (saves immediately).
  const updatePhoto = async (member, e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setActionError('')
    try {
      const url = await fileToDataUrl(file)
      const updated = await membersApi.update(member.id, { photo: url })
      setMembers((list) => list.map((m) => (m.id === member.id ? updated : m)))
      setJustAdded(member.id)
      setTimeout(() => setJustAdded(null), 2200)
    } catch (err) {
      setActionError(err.message || 'Could not update the photo.')
    }
  }

  const handleDelete = async () => {
    if (!editingId || saving) return
    setSaving(true)
    setFormError('')
    try {
      await membersApi.remove(editingId)
      setMembers((list) => list.filter((m) => m.id !== editingId))
      closeModal()
    } catch (err) {
      setFormError(err.message || 'Could not delete.')
    } finally {
      setSaving(false)
    }
  }

  // People available to pick as spouse / parents (everyone but the person being edited).
  const memberOptions = (members || [])
    .filter((m) => m.id !== editingId)
    .map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}`.trim() }))
  const isSingle = !form.maritalStatus || form.maritalStatus === 'Single'
  const spouseRequired = REQUIRES_SPOUSE.includes(form.maritalStatus)
  const editingHasChildren =
    editingId != null &&
    (members || []).some(
      (m) =>
        String(m.fatherId) === String(editingId) ||
        String(m.motherId) === String(editingId),
    )
  const nameById = (id) => {
    const p = (members || []).find((x) => String(x.id) === String(id))
    return p ? `${p.firstName} ${p.lastName}`.trim() : null
  }

  return (
    <section className="section">
      <div className="admin-bar">
        <span className="admin-status">
          🔒 Signed in as <strong>{username}</strong>
        </span>
        <div className="admin-actions">
          <button type="button" className="btn-ghost" onClick={() => setShowAccount(true)}>
            Change login
          </button>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      <div className="section-head section-head-row">
        <div>
          <h2 className="section-title">Demographic Records</h2>
          <p className="section-sub">
            Admin entry — add and review the people of the family. Changes are saved.
          </p>
        </div>
        <button type="button" className="btn-primary btn-add" onClick={openModal}>
          ＋ Add Member
        </button>
      </div>

      {loadError && <p className="bday-status is-error">{loadError}</p>}
      {actionError && <p className="bday-status is-error">{actionError}</p>}

      <div className="roster roster-full">
        <div className="roster-head">
          <h3 className="form-title">Family Roster</h3>
          <span className="count-pill">
            {members === null ? '…' : `${members.length} people`}
          </span>
        </div>

        {members === null ? (
          <p className="roster-loading">Loading records…</p>
        ) : members.length === 0 ? (
          <p className="roster-loading">
            No records yet — click “＋ Add Member” to add the first person.
          </p>
        ) : (
          <ul className="roster-list">
            {members.map((m) => (
              <li
                key={m.id}
                className={`roster-row ${justAdded === m.id ? 'roster-row-new' : ''}`}
              >
                <label className="roster-photo" title="Click to update photo">
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => updatePhoto(m, e)}
                  />
                  <Avatar member={m} className="avatar" />
                  <span className="roster-photo-overlay" aria-hidden="true">
                    📷
                  </span>
                </label>
                <div className="roster-info">
                  <p className="roster-name">
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="roster-meta">
                    {[m.branch, [m.city, m.country].filter(Boolean).join(', ')]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                  {(m.maritalStatus || m.spouseId || m.fatherId || m.motherId) && (
                    <p className="roster-rel">
                      {[
                        m.maritalStatus,
                        nameById(m.spouseId) && `♥ ${nameById(m.spouseId)}`,
                        (nameById(m.fatherId) || nameById(m.motherId)) &&
                          `child of ${[nameById(m.fatherId), nameById(m.motherId)]
                            .filter(Boolean)
                            .join(' & ')}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                {m.birthday && (
                  <time className="roster-bday">{formatShort(m.birthday)}</time>
                )}
                <button
                  type="button"
                  className="roster-edit"
                  onClick={() => openEdit(m)}
                  aria-label={`Edit ${m.firstName} ${m.lastName}`}
                >
                  ✎ Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Family member"
          >
            <div className="modal-head">
              <h3 className="form-title">
                {editingId ? 'Edit Family Member' : 'Add a Family Member'}
              </h3>
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
              <div className="photo-upload">
                <Avatar member={form} className="avatar avatar-xl" />
                <div className="photo-upload-actions">
                  <label className="btn-ghost">
                    <input type="file" accept="image/*" onChange={handlePhoto} hidden />
                    {form.photo ? 'Change photo' : 'Upload photo'}
                  </label>
                  {form.photo && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setForm((f) => ({ ...f, photo: '' }))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>First name</span>
                  <input
                    value={form.firstName}
                    onChange={update('firstName')}
                    placeholder="e.g. Naomie"
                    autoFocus
                    required
                  />
                </label>
                <label className="field">
                  <span>Last name</span>
                  <input value={form.lastName} onChange={update('lastName')} />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Birthday</span>
                  <input type="date" value={form.birthday} onChange={update('birthday')} />
                </label>
                <label className="field">
                  <span>Gender</span>
                  <select value={form.gender} onChange={update('gender')}>
                    <option value="">Select…</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Branch / Generation</span>
                  <input
                    value={form.branch}
                    onChange={update('branch')}
                    placeholder="e.g. Second Generation"
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={update('email')}
                    placeholder="name@example.com"
                  />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>City</span>
                  <input value={form.city} onChange={update('city')} placeholder="e.g. Miami" />
                </label>
                <label className="field">
                  <span>Country</span>
                  <input value={form.country} onChange={update('country')} placeholder="e.g. USA" />
                </label>
              </div>

              <p className="form-subhead">Relationships</p>

              <div className="field-row">
                <label className="field">
                  <span>Marital status</span>
                  <select value={form.maritalStatus} onChange={onMaritalChange}>
                    <option value="">Select…</option>
                    {MARITAL_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    Married / partnered to{spouseRequired ? ' *' : ''}
                  </span>
                  <select
                    value={form.spouseId}
                    onChange={update('spouseId')}
                    disabled={isSingle}
                    aria-required={spouseRequired}
                  >
                    <option value="">{isSingle ? '—' : 'Select…'}</option>
                    {memberOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Father</span>
                  <select value={form.fatherId} onChange={update('fatherId')}>
                    <option value="">Select…</option>
                    {memberOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Mother</span>
                  <select value={form.motherId} onChange={update('motherId')}>
                    <option value="">Select…</option>
                    {memberOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {memberOptions.length === 0 && (
                <p className="form-hint">
                  Add more people first to link spouses and parents.
                </p>
              )}

              <label className="field">
                <span>Notes</span>
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={update('notes')}
                  placeholder="A short note about this person…"
                />
              </label>

              {formError && <p className="bday-status is-error">{formError}</p>}
              {editingHasChildren && (
                <p className="form-hint">
                  This person is listed as a parent, so they can’t be deleted. Remove or
                  reassign their children first.
                </p>
              )}

              <div className="modal-actions">
                {editingId && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleDelete}
                    disabled={saving || editingHasChildren}
                    title={
                      editingHasChildren
                        ? 'Listed as a parent — remove their children first'
                        : 'Delete this record'
                    }
                  >
                    Delete
                  </button>
                )}
                <span className="modal-actions-spacer" />
                <button type="button" className="btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccount && (
        <ChangeCredentials
          onClose={() => setShowAccount(false)}
          onChanged={() => setUsername(getCredentials().username)}
        />
      )}
    </section>
  )
}

function formatShort(iso) {
  const [, month, day] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(month) - 1]} ${Number(day)}`
}
