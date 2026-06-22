import { chromium } from 'playwright-core'

const URL = process.env.SHOOT_URL || 'https://www.pierreblaisefamily.com'
const PW = process.env.ADMIN_PW || ''
const DIR = 'docs/screenshots'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 1280, height: 1400 },
  deviceScaleFactor: 2,
})

const tab = (re) => page.getByRole('tab', { name: re })

// Force lazy images to load and scroll the page so they decode before capture.
async function loadImages() {
  await page.evaluate(() => {
    for (const img of document.images) img.loading = 'eager'
  })
  await page.evaluate(async () => {
    await new Promise((r) => {
      let y = 0
      const step = () => {
        window.scrollTo(0, y)
        y += 600
        if (y < document.body.scrollHeight) setTimeout(step, 100)
        else { window.scrollTo(0, 0); r() }
      }
      step()
    })
  })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
}

async function full(name) {
  await loadImages()
  await page.screenshot({ path: `${DIR}/${name}`, fullPage: true })
  console.log('• ' + name)
}

async function modalShot(name) {
  await loadImages()
  await page.locator('.modal').screenshot({ path: `${DIR}/${name}` })
  console.log('• ' + name + ' (modal)')
}

await page.goto(URL, { waitUntil: 'networkidle' })

// ---- Public screens ----
await tab(/Family Tree/i).click()
await page.waitForTimeout(800)
await full('01-home.png')

await tab(/Jean-Marie Pierre/i).click()
await page.waitForTimeout(800)
await full('02-jean-marie.png')

await tab(/Events/i).click()
await page.waitForSelector('.event-card', { timeout: 30000 })
await full('03-events.png')

// Lightbox: open the first photo in the swipeable stack.
await loadImages()
await page.locator('.media-open').first().click()
await page.waitForSelector('.lightbox-overlay', { timeout: 15000 })
// Wait for the full-size lightbox image to actually decode (it starts black).
await page.waitForFunction(() => {
  const img = document.querySelector('.lightbox-figure img')
  return img && img.complete && img.naturalWidth > 0
}, { timeout: 30000 })
await page.waitForTimeout(600)
// Screenshot the overlay element (an ancestor transform scopes position:fixed,
// so a viewport shot would leak the masthead).
await page.locator('.lightbox-overlay').screenshot({ path: `${DIR}/04-lightbox.png` })
console.log('• 04-lightbox.png')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

await tab(/Birthdays/i).click()
await page.waitForTimeout(1000)
await full('05-birthdays.png')

// Demographics while signed OUT → the login screen.
await tab(/Demographics/i).click()
await page.waitForSelector('.login-card', { timeout: 15000 })
await page.waitForTimeout(500)
await full('06-login.png')

if (!PW) {
  console.log('! ADMIN_PW not set — skipping 07/08/09/10 (gated screens)')
  await browser.close()
  process.exit(0)
}

// ---- Admin sign-in ----
await page.locator('.login-card input[type="password"]').fill(PW)
await page.locator('.login-card button[type="submit"]').click()
await page.waitForSelector('text=/Demographic Records|Family Roster|Add Member/i', { timeout: 20000 })
await page.waitForTimeout(1000)
await full('07-demographics.png')

// Add Member form (now includes Life story + Photo gallery).
await page.getByRole('button', { name: /Add Member/i }).click()
await page.waitForSelector('.modal', { timeout: 15000 })
await page.waitForTimeout(800)
await modalShot('08-member-form.png')
await page.locator('.modal .modal-close').click()
await page.waitForTimeout(500)

// ---- Broadcast (password prompt → composer). Never click "Send Broadcast". ----
await tab(/Events/i).click()
await page.waitForSelector('.event-broadcast', { timeout: 20000 })
await page.locator('.event-broadcast').first().click()
await page.waitForSelector('.modal', { timeout: 15000 })
await page.waitForTimeout(600)
await modalShot('09-broadcast-password.png')

await page.locator('.modal input[type="password"]').fill(PW)
await page.locator('.modal button[type="submit"]').click()
await page.waitForSelector('text=/Broadcast/i', { timeout: 20000 })
await page.waitForTimeout(1000)
await modalShot('10-broadcast-compose.png')

await browser.close()
console.log('done.')
