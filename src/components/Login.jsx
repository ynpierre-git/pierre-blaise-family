import { useState } from 'react'
import { verify } from '../auth.js'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (verify(username.trim(), password)) {
      setError('')
      onLogin()
    } else {
      setError('Incorrect username or password.')
    }
  }

  return (
    <section className="section login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-badge" aria-hidden="true">🔒</div>
        <h2 className="login-title">Admin Access</h2>
        <p className="login-sub">Sign in to manage demographic records.</p>

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

        <button type="submit" className="btn-primary">
          Sign In
        </button>
      </form>
    </section>
  )
}
