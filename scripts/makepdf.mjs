import { chromium } from 'playwright-core'
import { marked } from 'marked'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const md = readFileSync('docs/USER_GUIDE.md', 'utf8')
// Drop the in-page table of contents (anchor links don't help in a PDF).
const cleaned = md.replace(/## Contents[\s\S]*?\n---\n/, '')
const body = marked.parse(cleaned)

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #2b2620; line-height: 1.6; font-size: 12pt; }
  h1 { font-size: 26pt; color: #233a2f; border-bottom: 3px solid #bd7333; padding-bottom: 8px; }
  h2 { font-size: 17pt; color: #2f4a3c; margin-top: 26px; border-bottom: 1px solid #cdbf9f; padding-bottom: 4px; page-break-after: avoid; }
  h3 { font-size: 13pt; color: #233a2f; margin-top: 18px; page-break-after: avoid; }
  a { color: #7a3338; text-decoration: none; }
  img { max-width: 78%; display: block; margin: 12px auto; border: 1px solid #cdbf9f; border-radius: 8px; page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 11pt; }
  th, td { border: 1px solid #cdbf9f; padding: 6px 10px; text-align: left; }
  th { background: #f3ead8; }
  blockquote { border-left: 4px solid #bd7333; margin: 12px 0; padding: 4px 16px; background: #faf4e6; color: #5b5147; }
  code { background: #f3ead8; padding: 1px 5px; border-radius: 4px; font-size: 10.5pt; }
  hr { border: none; border-top: 1px solid #cdbf9f; margin: 22px 0; }
  h2, h3, p, blockquote, table { page-break-inside: avoid; }
</style></head><body>${body}</body></html>`

// Write the HTML inside docs/ so the relative screenshot paths resolve when the
// page is loaded as a real file:// URL (setContent uses about:blank, which Chrome
// blocks from reading local files).
const tmp = resolve('docs/_guide.tmp.html')
writeFileSync(tmp, html)

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  // Allow reading the local screenshot files into a canvas (to downscale them)
  // without tainting it.
  args: ['--allow-file-access-from-files', '--disable-web-security'],
})
const page = await browser.newPage()
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' })
const bad = await page.evaluate(
  () => Array.from(document.images).filter((i) => !i.complete || !i.naturalWidth).length,
)
if (bad) throw new Error(`${bad} image(s) failed to load`)

// Downscale the (retina) screenshots to keep the PDF small — they're embedded at
// source resolution otherwise, ballooning the file to tens of MB.
await page.evaluate(async () => {
  const MAX_W = 1100
  for (const img of Array.from(document.images)) {
    const scale = Math.min(1, MAX_W / img.naturalWidth)
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * scale)
    c.height = Math.round(img.naturalHeight * scale)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    img.src = c.toDataURL('image/jpeg', 0.85)
    await img.decode().catch(() => {})
  }
})
await page.pdf({
  path: 'public/pierre-blaise-family-guide.pdf',
  format: 'A4',
  printBackground: true,
})
await browser.close()
rmSync(tmp)
console.log('• wrote public/pierre-blaise-family-guide.pdf (all images loaded)')
