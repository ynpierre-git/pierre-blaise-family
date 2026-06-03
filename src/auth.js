// ⚠️ Client-side only — NOT real security.
// Credentials live in the browser (localStorage) and are visible to anyone
// who opens dev tools. This only gates the UI. Replace with a real backend
// (hashed passwords, server sessions) before trusting it with anything.

const STORAGE_KEY = 'pbfam_credentials'
const DEFAULTS = { username: 'pbfam', password: 'password123' }

export function getCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore malformed storage */
  }
  return { ...DEFAULTS }
}

export function setCredentials(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function verify(username, password) {
  const c = getCredentials()
  return username === c.username && password === c.password
}
