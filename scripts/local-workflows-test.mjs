import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream'] })
let failed = 0
await mkdir('.local-checks', { recursive: true })

async function check(name, fn) {
  if (process.env.TEST_FILTER && !name.includes(process.env.TEST_FILTER)) return
  // Give each synthetic camera scenario a fresh device process. Reusing Chrome's
  // fake camera after a canceled start can report NotFoundError in the next context.
  const cameraBrowser = name.includes('synthetic') ? await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream'] }) : null
  const context = await (cameraBrowser || browser).newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', permissions: ['camera'] })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  try {
    await fn(page, context)
    assert.deepEqual(errors, [], 'unexpected browser errors')
    console.log(`PASS ${name}`)
  } catch (error) {
    failed++
    await page.screenshot({ path: `.local-checks/failure-${failed}.png` }).catch((captureError) => console.error(`Failure screenshot unavailable: ${captureError.message}`))
    const cameraError = await page.evaluate(() => window.cameraError || '').catch(() => 'page unavailable')
    console.error(`FAIL ${name}\n${error.stack}\nBrowser errors: ${JSON.stringify(errors)}\nCamera error: ${cameraError}`)
  } finally { await context.close(); await cameraBrowser?.close() }
}

async function signIn(page, email = 'alex@example.com') {
  await page.goto(`${BASE}/signin`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.waitForURL(email === 'admin@trace.app' ? '**/admin' : '**/dashboard')
}

async function reportDetails(page, title = 'Reliability test wallet') {
  await page.goto(`${BASE}/report?type=lost`)
  await page.getByLabel('Item name', { exact: true }).fill(title)
  await page.getByLabel('Category', { exact: true }).selectOption('Wallets & Cards')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.locator('#description').fill('A small black wallet with a distinctive blue strap on the side.')
  await page.locator('#location').selectOption('University Library')
  await page.locator('#date').fill('2020-01-01')
}

async function imageFile(page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 20; canvas.height = 20
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#40506A'; ctx.fillRect(0, 0, 20, 20)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

async function createReport(page, type, title, privateDetails) {
  await page.goto(`${BASE}/report?type=${type}`)
  await page.getByLabel('Item name', { exact: true }).fill(title)
  await page.getByLabel('Category', { exact: true }).selectOption('Other')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.locator('#description').fill('A distinctive item with a patterned cover found near the local library.')
  await page.locator('#location').selectOption('University Library')
  await page.locator('#date').fill('2020-01-01')
  await page.locator('#privateDetails').fill(privateDetails)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Submit Report' }).click()
  await page.waitForURL('**/items/*')
  return new URL(page.url()).pathname.split('/').at(-1)
}

await check('linked claim carries private evidence through review and closes both reports at handoff', async (page) => {
  await signIn(page, 'finder@example.com')
  const foundId = await createReport(page, 'found', 'Linked workflow found item', 'Finder-only hidden mark')
  assert.equal(await page.getByText('Finder-only hidden mark', { exact: true }).count(), 0)
  await signIn(page)
  const lostId = await createReport(page, 'lost', 'Linked workflow lost item', 'Claimant-only matching mark')
  await page.setViewportSize({ width: 390, height: 640 })
  await page.goto(`${BASE}/items/${foundId}`)
  assert.equal(await page.getByText('Finder-only hidden mark', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Submit a Claim' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Link your lost report', { exact: false }).selectOption(lostId)
  const panel = await dialog.boundingBox()
  assert.ok(panel.height <= 640 - 16, 'claim modal overflows the mobile viewport')
  await dialog.locator('#statement').fill('This looks like the item I lost near the library on Monday.')
  await dialog.locator('#q1').fill('The cover has a distinctive mark')
  await dialog.locator('#q2').fill('I left it near the library')
  await dialog.locator('#q3').fill('There is a pattern on the inside')
  await dialog.getByRole('button', { name: 'Submit Claim' }).click()
  await page.waitForURL('**/dashboard?tab=claims')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('trace_state_v2')))
  assert.equal(saved.claims.find((claim) => claim.itemId === foundId).relatedLostReportId, lostId)
  await signIn(page, 'admin@trace.app')
  const row = page.getByRole('listitem').filter({ hasText: 'Linked workflow found item' })
  await row.getByText('Finder-only hidden mark', { exact: false }).waitFor()
  await row.getByText('Claimant-only matching mark', { exact: false }).waitFor()
  await row.getByRole('button', { name: 'Approve Claim' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  const decided = page.getByRole('listitem').filter({ hasText: 'Linked workflow found item' })
  await decided.getByRole('button', { name: 'Confirm Handoff' }).click()
  await page.getByRole('dialog').getByLabel('Handoff record').fill('Handed to the claimant at the demo desk')
  await page.getByRole('dialog').getByRole('button', { name: 'Record Handoff' }).click()
  await page.waitForFunction(({ foundId, lostId }) => {
    const state = JSON.parse(localStorage.getItem('trace_state_v2'))
    return state.items.find((item) => item.id === foundId)?.status === 'returned' &&
      state.items.find((item) => item.id === lostId)?.status === 'returned'
  }, { foundId, lostId })
})

await check('failed report persistence keeps the review step and allows retry', async (page) => {
  await signIn(page)
  await reportDetails(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('heading', { name: 'Review your report' }).waitFor()
  await page.evaluate(() => {
    window.restoreSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'trace_state_v2') throw new DOMException('Full', 'QuotaExceededError')
      return window.restoreSetItem.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Submit Report' }).click()
  await page.getByText('Changes were not saved.', { exact: false }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/report')
  assert.equal(await page.evaluate(() => localStorage.getItem('trace_state_v2')), null)
  assert.equal(await page.getByText('Lost item report submitted', { exact: true }).count(), 0)
  await page.evaluate(() => { Storage.prototype.setItem = window.restoreSetItem })
  await page.getByRole('button', { name: 'Submit Report' }).click()
  await page.waitForURL('**/items/*')
  await page.getByText('No photo provided', { exact: true }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: 'Reliability test wallet' }).waitFor()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('trace_state_v2')).items.filter((item) => item.title === 'Reliability test wallet').length), 1)
})

await check('corrupt nested storage is preserved and the app stays readable', async (page) => {
  const raw = JSON.stringify({ items: [], claims: [{ questions: null }], notifications: [], audit: [] })
  await page.addInitScript((value) => localStorage.setItem('trace_state_v2', value), raw)
  await page.goto(`${BASE}/discover`)
  await page.getByRole('heading', { name: 'Browse lost & found listings.' }).waitFor()
  await page.getByText('Saved demo data is damaged.', { exact: false }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('trace_state_v2')), raw)
})

await check('photos block navigation and duplicate batches while processing', async (page) => {
  await page.addInitScript(() => {
    const original = window.createImageBitmap.bind(window)
    window.createImageBitmap = (...args) => new Promise((resolve, reject) => {
      window.finishPhoto = () => original(...args).then(resolve, reject)
    })
  })
  await signIn(page)
  await reportDetails(page)
  const file = await imageFile(page)
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByText('Processing photos… Please wait before continuing.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), true)
  assert.equal(await page.locator('input[type=file]').isDisabled(), true)
  await page.locator('#description').evaluate((element) => {
    const form = element.closest('form')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  assert.equal(new URL(page.url()).pathname, '/report')
  await page.evaluate(() => window.finishPhoto())
  await page.getByAltText('Preview 1', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isEnabled(), true)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Submit Report' }).click()
  await page.waitForURL('**/items/*')
  const images = await page.evaluate(() => JSON.parse(localStorage.getItem('trace_state_v2')).items[0].images)
  assert.equal(images.length, 1)
  assert.match(images[0], /^data:image\/jpeg;/)
})

await check('photo decoder fallback works without createImageBitmap', async (page) => {
  await page.addInitScript(() => { window.createImageBitmap = undefined })
  await signIn(page)
  await reportDetails(page)
  await page.locator('input[type=file]').setInputFiles(await imageFile(page))
  await page.getByAltText('Preview 1', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isEnabled(), true)
})

await check('leaving during photo processing does not publish a report', async (page) => {
  await page.addInitScript(() => {
    const original = window.createImageBitmap.bind(window)
    window.createImageBitmap = (...args) => new Promise((resolve, reject) => {
      window.finishPhoto = () => original(...args).then(resolve, reject)
    })
  })
  await signIn(page)
  await reportDetails(page)
  await page.locator('input[type=file]').setInputFiles(await imageFile(page))
  await page.getByText('Processing photos… Please wait before continuing.').waitFor()
  await page.getByRole('link', { name: 'TRACE home' }).click()
  await page.waitForURL(BASE + '/')
  await page.evaluate(() => window.finishPhoto())
  assert.equal(await page.evaluate(() => localStorage.getItem('trace_state_v2')), null)
})

async function instrumentCamera(page, deferred) {
  await page.addInitScript((delay) => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.cameraTracks = []
    window.cameraRequests = 0
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.cameraRequests++
      let stream
      try { stream = await getUserMedia(constraints) }
      catch (error) { window.cameraError = `${error.name}: ${error.message}`; throw error }
      window.cameraTracks.push(...stream.getTracks())
      if (delay) await new Promise((resolve) => { window.releaseCamera = resolve })
      return stream
    }
  }, deferred)
  await page.goto(`${BASE}/items/item_wallet`)
  await page.getByRole('button', { name: 'Scan a QR Code' }).click()
  await page.getByRole('button', { name: 'Grant Camera & Start' }).click()
}

await check('closing during synthetic camera startup stops late tracks', async (page) => {
  await instrumentCamera(page, true)
  await page.waitForFunction(() => typeof window.releaseCamera === 'function')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.evaluate(() => window.releaseCamera())
  await page.waitForFunction(() => window.cameraTracks.length && window.cameraTracks.every((track) => track.readyState === 'ended'))
})

await check('navigating away from a synthetic active scanner stops tracks', async (page) => {
  await instrumentCamera(page, false)
  await page.locator('#trace-qr-reader video').waitFor()
  await page.waitForFunction(() => window.cameraTracks.some((track) => track.readyState === 'live'))
  await page.getByRole('link', { name: 'TRACE home' }).evaluate((link) => link.click())
  await page.waitForURL(BASE + '/')
  await page.waitForFunction(() => window.cameraTracks.length && window.cameraTracks.every((track) => track.readyState === 'ended'))
})

await check('community publishing, filters, reload and author removal work', async (page) => {
  await signIn(page)
  await page.goto(`${BASE}/community`)
  await page.getByRole('heading', { name: 'Community Board', exact: true }).waitFor()
  assert.equal(await page.locator('#post-category option').allTextContents().then((values) => values.includes('Announcement')), false)
  await page.getByLabel('Title', { exact: true }).fill('Helpful community update')
  await page.getByLabel('Message', { exact: true }).fill('Please keep private ownership details off public community posts.')
  await page.getByRole('button', { name: 'Publish post', exact: true }).click()
  await page.getByRole('heading', { name: 'Helpful community update' }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: 'Helpful community update' }).waitFor()
  await page.getByLabel('Search posts', { exact: true }).fill('no-such-post')
  await page.getByRole('heading', { name: 'No matching posts.' }).waitFor()
  await page.getByLabel('Search posts', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Remove post: Helpful community update' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('heading', { name: 'Helpful community update' }).waitFor()
  await page.getByRole('button', { name: 'Remove post: Helpful community update' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove post', exact: true }).click()
  await page.getByRole('heading', { name: 'The board is ready for its first post.' }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: 'The board is ready for its first post.' }).waitFor()
})

await check('community isolates member controls and supports admin moderation', async (page) => {
  await signIn(page)
  await page.goto(`${BASE}/community`)
  await page.getByLabel('Title', { exact: true }).fill('Member moderation fixture')
  await page.getByLabel('Message', { exact: true }).fill('This post is a sample for verifying moderation controls.')
  await page.getByRole('button', { name: 'Publish post', exact: true }).click()
  await page.getByRole('heading', { name: 'Member moderation fixture' }).waitFor()
  await signIn(page, 'another@example.com')
  await page.goto(`${BASE}/community`)
  await page.getByRole('heading', { name: 'Member moderation fixture' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Remove post: Member moderation fixture' }).count(), 0)
  await signIn(page, 'admin@trace.app')
  await page.goto(`${BASE}/community`)
  await page.locator('#post-category').selectOption('Announcement')
  await page.getByLabel('Title', { exact: true }).fill('Demo desk announcement')
  await page.getByLabel('Message', { exact: true }).fill('This is a demo announcement and not an official city notice.')
  await page.getByRole('button', { name: 'Publish post', exact: true }).click()
  await page.getByRole('heading', { name: 'Demo desk announcement' }).waitFor()
  await page.getByRole('button', { name: 'Remove post: Member moderation fixture' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove post', exact: true }).click()
  await page.getByRole('heading', { name: 'Member moderation fixture' }).waitFor({ state: 'detached' })
})

await check('failed community writes keep the draft and leave no new post', async (page) => {
  await signIn(page)
  await page.goto(`${BASE}/community`)
  await page.getByLabel('Title', { exact: true }).fill('Unsaved community post')
  await page.getByLabel('Message', { exact: true }).fill('This draft must survive a failed local storage write.')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'trace_community_v1') throw new Error('Quota exceeded')
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Publish post', exact: true }).click()
  await page.getByRole('alert').getByText('Changes were not saved.', { exact: false }).waitFor()
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Unsaved community post')
  assert.equal(await page.locator('article').count(), 0)
})

await check('community layout and navigation fit desktop, tablet and mobile', async (page) => {
  await signIn(page)
  await page.goto(`${BASE}/community`)
  await page.getByLabel('Title', { exact: true }).fill('Mandaluyong community update')
  await page.getByLabel('Message', { exact: true }).fill('Use item reports to share lost or found belongings. Keep your private identifying details out of public posts.')
  await page.getByRole('button', { name: 'Publish post', exact: true }).click()
  for (const width of [1440, 1024, 820, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.getByRole('heading', { name: 'Mandaluyong community update' }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`)
    for (const toast of await page.locator('[aria-live="polite"] > div').all()) {
      const bounds = await toast.boundingBox()
      if (bounds) assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `toast clipping at ${width}`)
    }
    if (width >= 1280) {
      const brand = await page.getByRole('link', { name: 'TRACE home' }).boundingBox()
      const nav = await page.locator('nav[aria-label=Primary]').boundingBox()
      const action = await page.locator('header > a[href="/report"]').boundingBox()
      assert.ok(brand.x + brand.width < nav.x && nav.x + nav.width < action.x, `header overlap at ${width}`)
    } else {
      await page.getByRole('button', { name: 'Open menu' }).click()
      await page.locator('nav[aria-label=Mobile]').getByRole('link', { name: 'Community', exact: true }).waitFor()
      await page.keyboard.press('Escape')
      assert.ok(await page.getByRole('button', { name: 'Open menu' }).evaluate((element) => element === document.activeElement))
    }
    await page.screenshot({ path: `.local-checks/community-${width}.png`, fullPage: true })
  }
})

await browser.close()
process.exitCode = failed ? 1 : 0
