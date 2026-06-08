import { useState } from 'react'
import { login } from '../auth.js'

export default function Login({ onLogin }) {
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
      onLogin()
    } catch (err) {
      setError(err.message || 'Incorrect password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-badge" aria-hidden="true">🔒</div>
        <h2 className="login-title">Admin Access</h2>
        <p className="login-sub">Enter the admin password to manage records.</p>

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

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </section>
  )
}
