// Local-development launcher. In production (Vercel) the app is served by
// api/index.js as a serverless function and this file is not used.
import app from './app.js'

const PORT = process.env.PORT || 3001
const emailConfigured = Boolean(process.env.RESEND_API_KEY)

app.listen(PORT, () => {
  const mode = emailConfigured ? 'LIVE (Resend)' : 'SIMULATED — set RESEND_API_KEY to send for real'
  console.log(`Pierre-Blaise server running on http://localhost:${PORT}  ·  email: ${mode}`)
})
