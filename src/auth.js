// Token-based admin auth. The password is verified on the SERVER (against a
// bcrypt hash kept in an env var); the browser only ever holds a short-lived
// signed token. Viewing the site needs nothing — only changes require the token,
// which the server enforces on every write. This is real security now, not just
// a UI gate.

const API = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'pbfam_token'

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function isAuthed() {
  return Boolean(getToken())
}

export function logout() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

// Exchanges the admin password for a session token. Throws with a friendly
// message on failure.
export async function login(password) {
  const res = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Sign-in failed. Please try again.')
  try {
    sessionStorage.setItem(TOKEN_KEY, data.token)
  } catch {
    /* ignore */
  }
  return true
}
