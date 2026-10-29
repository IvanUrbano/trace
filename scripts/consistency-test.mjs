import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const results = []
let failed = 0

async function check(name, fn) {
  try {
    await fn()
    results.push(`PASS  ${name}`)
  } catch (err) {
    failed++
    results.push(`FAIL  ${name}\n      ${err.message.split('\n')[0]}`)
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`)
})

async function clearState() {
  await page.goto(BASE + '/')
  await page.evaluate(() => localStorage.clear())
  // second navigation picks up the cleared storage on a fresh load
  await page.goto(BASE + '/')
  await page.waitForLoadState('domcontentloaded')
}

// ---------- Static pages ----------
await check('Home loads with hero headline', async () => {
  await page.goto(BASE + '/')
  await page.waitForSelector('h1:has-text("Lost something?")', { timeout: 8000 })
})

await check('Home sections present (7 landmarks)', async () => {
  for (const t of [
    'Somewhere, someone is looking for this.',
    'Four steps. One less thing to worry about.',
    'Found a match.',
    'Finding it is only half the story.',
    'One scan away from a report.',
  ]) {
    await page.waitForSelector(`text=${t}`, { timeout: 5000 })
  }
  await page.waitForSelector('text=Report a Lost Item', { timeout: 5000 })
})

await check('Nav How It Works scrolls to section', async () => {
  await page.goto(BASE + '/')
  await page.click('nav >> text=How It Works')
  await page.waitForTimeout(800)
  const inView = await page.evaluate(() => {
    const el = document.getElementById('how-it-works')
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.top < window.innerHeight && r.bottom > 0
  })
  if (!inView) throw new Error('how-it-works not in viewport after nav click')
})

await check('Discover loads with filters and cards', async () => {
  await page.goto(BASE + '/discover')
  await page.waitForSelector('text=/\\d+ items? found/', { timeout: 8000 })
  await page.waitForSelector('article', { timeout: 5000 })
})

await check('Discover filter lost/found toggle works', async () => {
  await page.goto(BASE + '/discover')
  await page.waitForSelector('article')
  const before = await page.locator('article').count()
  await page.click('button:has-text("Lost")')
  await page.waitForTimeout(700)
  const url = page.url()
  if (!url.includes('type=lost')) throw new Error('URL param type=lost missing')
  const after = await page.locator('article').count()
  if (after > before) throw new Error(`lost filter increased results ${before}->${after}`)
})

await check('Discover search filters results', async () => {
  await page.goto(BASE + '/discover')
  await page.waitForSelector('article')
  await page.fill('input[type="search"]', 'wallet')
  await page.waitForSelector('article', { timeout: 8000 })
  await page.waitForTimeout(200)
  const count = await page.locator('article').count()
  if (count === 0) throw new Error('search for wallet returned 0 items')
  const text = await page.locator('article').first().innerText()
  if (!/wallet/i.test(text)) throw new Error('first result is not a wallet')
})

await check('Item details page renders QR + timeline', async () => {
  await page.goto(BASE + '/items/item_wallet')
  await page.waitForSelector('h1:has-text("Black Leather Wallet")', { timeout: 8000 })
  await page.waitForSelector('text=Status timeline')
  const hasQr = await page.locator('svg.qrcode, canvas').count()
  const hasQrText = await page.locator('text=/https?:\\/\\//').count()
  if (hasQr === 0 && hasQrText === 0) throw new Error('no QR or URL found')
})

await check('Item not-found state', async () => {
  await page.goto(BASE + '/items/does_not_exist')
  await page.waitForSelector("text=This listing doesn't exist.", { timeout: 5000 })
})

await check('Privacy + Terms load', async () => {
  await page.goto(BASE + '/privacy')
  await page.waitForSelector('h1:has-text("Privacy Policy")')
  await page.goto(BASE + '/terms')
  await page.waitForSelector('h1:has-text("Terms of Service")')
})

await check('404 route works', async () => {
  await page.goto(BASE + '/nope')
  await page.waitForSelector('text=Page not found.')
})

await check('Footer links exist and navigate', async () => {
  await page.goto(BASE + '/')
  await page.click('footer >> text=Privacy Policy')
  await page.waitForSelector('h1:has-text("Privacy Policy")')
})

// ---------- Auth ----------
await check('Sign in as user navigates to dashboard', async () => {
  await clearState()
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'alex@example.com')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 8000 })
  await page.waitForSelector('text=Welcome back, Alex')
})

await check('Sign in as admin navigates to /admin', async () => {
  await clearState()
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'admin@trace.app')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin', { timeout: 8000 })
  await page.waitForSelector('text=Review queue.')
})

await check('Invalid email shows inline error', async () => {
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'not-an-email')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Enter a valid email address.', { timeout: 5000 })
})

// ---------- Report flow ----------
await check('Report form: validation blocks empty step', async () => {
  await clearState()
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'alex@example.com')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
  await page.goto(BASE + '/report')
  await page.waitForSelector('form')
  await page.click('button:has-text("Continue")')
  await page.waitForSelector('text=/at least 3 characters/', { timeout: 5000 })
})

await check('Report form: full submit creates item and navigates', async () => {
  await page.goto(BASE + '/report?type=found')
  await page.waitForSelector('form')
  await page.fill('#title', 'Blue Umbrella')
  await page.selectOption('#category', 'Other')
  await page.click('button:has-text("Continue")')
  await page.fill('#description', 'A compact blue umbrella left near the north entrance after rain.')
  await page.selectOption('#location', 'Student Union')
  await page.click('button:has-text("Continue")')
  await page.waitForSelector('text=Review your report')
  await page.click('button:has-text("Submit Report")')
  await page.waitForURL('**/items/**', { timeout: 8000 })
  await page.waitForSelector('h1:has-text("Blue Umbrella")')
})

// ---------- Claim flow ----------
await check('Guest on found item sees claim CTA → claim page sign-in', async () => {
  await clearState()
  await page.goto(BASE + '/items/item_headphones')
  await page.waitForSelector('h1:has-text("Wireless Headphones")')
  await page.click('a:has-text("Submit a Claim"), button:has-text("Submit a Claim")')
  await page.waitForURL('**/claim/**', { timeout: 5000 })
  await page.waitForSelector('text=Sign in to submit a claim.')
})

await check('Signed-in user submits claim successfully', async () => {
  await clearState()
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'sam@example.com')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
  await page.goto(BASE + '/items/item_bottle')
  await page.waitForSelector('h1:has-text("Stainless Steel Water Bottle")')
  await page.click('button:has-text("Submit a Claim")')
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
  await page.fill('#statement', 'This is my gym bottle with a dent near the base from last month.')
  await page.fill('#q1', 'Matte black, no case')
  await page.fill('#q2', 'Small dent near the base')
  await page.fill('#q3', 'Hydro Flask 750ml')
  await page.click('button:has-text("Submit Claim")')
  await page.waitForURL('**/dashboard?tab=claims', { timeout: 8000 })
  await page.waitForSelector('text=Stainless Steel Water Bottle')
})

await check('Second claim on same item shows View My Claim not form', async () => {
  await page.goto(BASE + '/items/item_bottle')
  await page.waitForSelector('h1:has-text("Stainless Steel Water Bottle")')
  await page.waitForSelector('a:has-text("View My Claim")', { timeout: 5000 })
  const hasFormBtn = await page.locator('button:has-text("Submit a Claim")').count()
  if (hasFormBtn > 0) throw new Error('duplicate claim form still shown')
})

await check('Claim page shows status timeline for existing claim', async () => {
  await page.goto(BASE + '/claim/item_bottle')
  await page.waitForSelector('text=Claim status', { timeout: 5000 })
  await page.waitForSelector('text=Review progress')
})

// ---------- Dashboard ----------
await check('Dashboard tabs switch and show content', async () => {
  await page.goto(BASE + '/dashboard?tab=notifications')
  await page.waitForSelector('nav[aria-label="Dashboard sections"]')
  await page.click('button:has-text("My Lost Reports")')
  await page.waitForTimeout(300)
  if (!page.url().includes('tab=lost')) throw new Error('tab param not updated')
  await page.click('button:has-text("Possible Matches")')
  await page.waitForSelector('text=illustrative')
})

await check('Dashboard sign out clears session', async () => {
  await page.goto(BASE + '/dashboard')
  await page.click('button:has-text("Sign Out")')
  await page.waitForTimeout(400)
  await page.goto(BASE + '/dashboard')
  await page.waitForSelector('text=Sign in to view your dashboard.', { timeout: 5000 })
})

// ---------- Admin flow ----------
await check('Admin can approve claim and confirm handoff', async () => {
  await clearState()
  // seed claim by user
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'jamie@example.com')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
  await page.goto(BASE + '/items/item_keys')
  await page.click('button:has-text("Submit a Claim")')
  await page.waitForSelector('[role="dialog"]')
  await page.fill('#statement', 'Three keys with my tag — lost in the garage elevator last week.')
  await page.fill('#q1', 'No case, silver ring')
  await page.fill('#q2', 'Rectangular tag with initials')
  await page.fill('#q3', 'Generic, no brand')
  await page.click('button:has-text("Submit Claim")')
  await page.waitForURL('**/dashboard?tab=claims')

  // admin
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'admin@trace.app')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin')
  await page.waitForSelector('text=Pending claims')
  await page.click('button:has-text("Approve Claim")')
  await page.waitForSelector('[role="dialog"]')
  await page.fill('#admin-note', 'Answers match private details.')
  await page.click('[role="dialog"] >> button:has-text("Confirm")')
  await page.waitForTimeout(600)
  await page.waitForSelector('text=Decided claims')
  // confirm handoff
  const handoffBtn = page.locator('button:has-text("Confirm Handoff")').first()
  await handoffBtn.waitFor({ timeout: 5000 })
  await handoffBtn.click()
  await page.waitForSelector('text=Handoff recorded', { timeout: 5000 })
})

await check('Non-admin cannot access admin actions', async () => {
  await clearState()
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'alex@example.com')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
  await page.goto(BASE + '/admin')
  await page.waitForSelector('text=Administrator access required.', { timeout: 5000 })
})

await check('Rejected claim restores item to unclaimed', async () => {
  await clearState()
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'casey@example.com')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
  await page.goto(BASE + '/items/item_tote')
  await page.click('button:has-text("Submit a Claim")')
  await page.waitForSelector('[role="dialog"]')
  await page.fill('#statement', 'Canvas tote from the campus event — I left it on a cafe chair.')
  await page.fill('#q1', 'No pouch')
  await page.fill('#q2', 'Small coffee stain on the side')
  await page.fill('#q3', 'Campus event 2024 edition')
  await page.click('button:has-text("Submit Claim")')
  await page.waitForURL('**/dashboard?tab=claims')

  await page.goto(BASE + '/signin')
  await page.fill('#email', 'admin@trace.app')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin')
  await page.click('button:has-text("Decline")')
  await page.waitForSelector('[role="dialog"]')
  await page.fill('#admin-note', 'Details did not match.')
  await page.click('[role="dialog"] >> button:has-text("Confirm")')
  await page.waitForTimeout(600)

  await page.goto(BASE + '/items/item_tote')
  await page.waitForSelector('h1:has-text("Canvas Tote Bag")')
  await page.waitForSelector('text=Unclaimed', { timeout: 5000 })
})

// ---------- Notifications ----------
await check('Claim notification appears for claimant', async () => {
  await page.goto(BASE + '/signin')
  await page.fill('#email', 'casey@example.com')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
  await page.goto(BASE + '/dashboard?tab=notifications')
  await page.waitForSelector('text=/Claim (submitted|declined|approved)/', { timeout: 5000 })
  await page.click('button:has-text("Mark all read")')
  await page.waitForTimeout(300)
})

// ---------- Modal a11y ----------
await check('Modal closes on Escape', async () => {
  await page.goto(BASE + '/items/item_sleeve')
  await page.waitForSelector('h1:has-text("Laptop Sleeve")')
  await page.click('button:has-text("Submit a Claim")')
  await page.waitForSelector('[role="dialog"]')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const open = await page.locator('[role="dialog"]').count()
  if (open > 0) throw new Error('dialog still open after Escape')
})

// ---------- Reduced motion doesn't break UI ----------
await check('Content visible with reduced motion', async () => {
  const ctx2 = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 800 },
  })
  const p2 = await ctx2.newPage()
  await p2.goto(BASE + '/')
  await p2.waitForSelector('h1:has-text("Lost something?")', { timeout: 8000 })
  const opacity = await p2.locator('h1').evaluate((el) => getComputedStyle(el).opacity)
  await ctx2.close()
  if (opacity === '0') throw new Error('h1 invisible under reduced motion')
})

await browser.close()

console.log('\n=== CONSISTENCY RESULTS ===')
for (const r of results) console.log(r)
console.log(`\n${results.length - failed}/${results.length} passed`)
if (consoleErrors.length) {
  console.log('\n=== PAGE ERRORS (sample) ===')
  console.log([...new Set(consoleErrors)].slice(0, 10).join('\n'))
}
process.exit(failed > 0 ? 1 : 0)
