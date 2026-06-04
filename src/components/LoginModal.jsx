import { useState } from 'react'
import { verify } from '../auth.js'

// Compact sign-in dialog used to gate admin actions (add/edit) on pages that are
// otherwise open to everyone. Calls onSuccess() when the credentials check out.
export default function LoginModal({ title = '🔒 Sign in', onSuccess, onCancel }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (verify(username.trim(), password)) onSuccess()
    else setError('Incorrect username or password.')
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
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions">
            <span className="modal-actions-spacer" />
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
