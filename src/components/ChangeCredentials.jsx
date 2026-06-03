import { useEffect, useState } from 'react'
import { getCredentials, setCredentials, verify } from '../auth.js'

export default function ChangeCredentials({ onClose, onChanged }) {
  const current = getCredentials()
  const [username, setUsername] = useState(current.username)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    if (!verify(current.username, currentPassword)) {
      setError('Current password is incorrect.')
      return
    }
    if (!username.trim()) {
      setError('Username cannot be empty.')
      return
    }
    // Password change is optional; if either new field is filled, validate both.
    let password = current.password
    if (newPassword || confirm) {
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters.')
        return
      }
      if (newPassword !== confirm) {
        setError('New passwords do not match.')
        return
      }
      password = newPassword
    }
    setCredentials({ username: username.trim(), password })
    setError('')
    setDone(true)
    onChanged?.()
    setTimeout(onClose, 1100)
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Change login">
        <div className="modal-head">
          <h3 className="form-title">Change Login</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>

          {error && <p className="login-error">{error}</p>}
          {done && <p className="login-success">Saved! Your login has been updated.</p>}

          <div className="modal-actions">
            <span className="modal-actions-spacer" />
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
