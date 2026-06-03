// Vercel serverless entry point for the backend API.
// An Express app is a (req, res) handler, so Vercel can use it directly.
// vercel.json rewrites every /api/* request to this function; Express then
// matches the original path (/api/members, /api/events, ...).
import app from '../server/app.js'

export default app
