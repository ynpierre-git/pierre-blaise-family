import { useState } from 'react'
import { login } from '../auth.js'

// Compact sign-in dialog used to gate admin actions on pages that are otherwise
// open to everyone. Verifies the password with the server and stores a session
// token, then calls onSuccess().
export default function LoginModal({ title = '🔒 Sign in', onSuccess, onCancel }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await login(password)
      onSuccess()
    } catch (err) {
      setError(err.message || 'Incorrect password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Sign in">
        <div className="modal-head">
          <h3 className="form-title">{title}</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>
            ×
          </button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions">
            <span className="modal-actions-spacer" />
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
