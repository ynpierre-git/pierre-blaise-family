// Server-side admin authentication.
//
// The admin password is NEVER stored in the database or in the repo. Instead a
// bcrypt *hash* of it lives in an environment variable (ADMIN_PASSWORD_HASH),
// and a separate random secret (AUTH_SECRET) signs the short-lived session
// tokens we hand out after a correct password. Verifying a password compares it
// against the hash; the plaintext is never persisted anywhere.
//
// Generate the two values with: node scripts/make-admin-credentials.mjs "<pw>"

import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const SECRET = process.env.AUTH_SECRET || ''
const HASH = process.env.ADMIN_PASSWORD_HASH || ''
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// True only when both secrets are present, so routes can fail closed otherwise.
export const authConfigured = () => Boolean(SECRET && HASH)

const sign = (payload) =>
  crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')

// A minimal stateless token: base64url(JSON {exp}) + "." + HMAC signature.
export function issueToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString(
    'base64url',
  )
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token) {
  if (!token || !SECRET) return false
  const [payload, sig] = String(token).split('.')
  if (!payload || !sig) return false
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof exp === 'number' && Date.now() < exp
  } catch {
    return false
  }
}

export async function checkPassword(password) {
  if (!HASH || !password) return false
  try {
    return await bcrypt.compare(String(password), HASH)
  } catch {
    return false
  }
}

// Express middleware: require a valid Bearer token on protected routes.
export function requireAuth(req, res, next) {
  if (!authConfigured()) {
    return res
      .status(503)
      .json({ error: 'Admin authentication is not configured on the server.' })
  }
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (verifyToken(token)) return next()
  return res.status(401).json({ error: 'Not authorized. Please sign in again.' })
}
