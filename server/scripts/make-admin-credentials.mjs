// Generates the two server secrets for admin auth, WITHOUT storing your
// password anywhere. Run from the server/ folder:
//
//   node scripts/make-admin-credentials.mjs "your-admin-password"
//
// Copy the printed ADMIN_PASSWORD_HASH and AUTH_SECRET into your Vercel project's
// Environment Variables (Settings → Environment Variables), and into server/.env
// if you want to run the backend locally. Keep both secret; never commit them.

import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const password = process.argv[2]
if (!password || password.length < 8) {
  console.error('Usage: node scripts/make-admin-credentials.mjs "<password>"  (min 8 characters)')
  process.exit(1)
}

const hash = bcrypt.hashSync(password, 12)
const secret = crypto.randomBytes(32).toString('hex')

console.log('\nAdd these to your environment variables:\n')
console.log(`ADMIN_PASSWORD_HASH=${hash}`)
console.log(`AUTH_SECRET=${secret}`)
console.log(
  '\nKeep both secret and never commit them. Re-running generates a new AUTH_SECRET,\n' +
    'which signs out everyone with an existing session.\n',
)
