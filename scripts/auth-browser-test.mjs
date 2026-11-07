// Synthetic OIDC provider only: never submits real credentials or contacts AWS.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { loadEnv } from 'vite'
import { mkdir } from 'node:fs/promises'
const env = loadEnv('development', process.cwd(), 'VITE_')
const base = process.env.BASE_URL || 'http://localhost:5173'
const issuer = `https://cognito-idp.ap-southeast-1.amazonaws.com/${env.VITE_COGNITO_USER_POOL_ID}`
const domain = env.VITE_COGNITO_DOMAIN
assert.ok(domain && env.VITE_COGNITO_CLIENT_ID, 'Configure the ignored local Cognito settings first')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
await mkdir('.local-checks', { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  let challenge, nonce, logoutSeen = false
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(`${issuer}/**`, route => route.fulfill({ json: {
    issuer, authorization_endpoint: `${domain}/oauth2/authorize`, token_endpoint: `${domain}/oauth2/token`,
    jwks_uri: `${issuer}/keys`, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
  } }))
  await page.route(`${domain}/**`, async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/oauth2/authorize') {
      assert.equal(url.searchParams.get('scope'), 'openid email')
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
      challenge = url.searchParams.get('code_challenge')
      nonce = url.searchParams.get('nonce')
      const callback = new URL(env.VITE_COGNITO_REDIRECT_URI)
      callback.search = new URLSearchParams({ code: 'synthetic-code', state: url.searchParams.get('state') }).toString()
      return route.fulfill({ contentType: 'text/html', body: `<a href="${callback.href.replaceAll('&', '&amp;')}">Finish test login</a>` })
    }
    if (url.pathname === '/oauth2/token') {
      const body = new URLSearchParams(route.request().postData())
      assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'), challenge)
      const now = Math.floor(Date.now() / 1000)
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
      const token = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: issuer, aud: env.VITE_COGNITO_CLIENT_ID, sub: 'synthetic-user', email: 'synthetic@example.test', iat: now, exp: now + 3600, nonce })}.synthetic`
      return route.fulfill({ json: { access_token: 'synthetic-access', id_token: token, token_type: 'Bearer', expires_in: 3600 } })
    }
    if (url.pathname === '/logout') {
      assert.equal(url.searchParams.get('logout_uri'), env.VITE_COGNITO_LOGOUT_URI)
      logoutSeen = true
      return route.fulfill({ contentType: 'text/html', body: `<a href="${base}/">Finish test logout</a>` })
    }
    throw new Error('Unexpected identity request')
  })
  await page.goto(base)
  await page.evaluate(() => localStorage.setItem('trace_state_v2_user', JSON.stringify({ id: 'u_admin', email: 'admin@trace.app', name: 'Demo Admin', role: 'admin' })))
  await page.reload()
  await page.getByRole('banner').getByRole('link', { name: 'Sign In', exact: true }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Admin', exact: true }).count(), 0)
  await page.goto(`${base}/report?type=found`)
  await page.getByRole('button', { name: 'Continue to Sign In' }).click()
  await page.getByRole('link', { name: 'Finish test login' }).click()
  await page.waitForURL(`${base}/report?type=found`)
  await page.getByText('Signed in as synthetic@example.test').waitFor()
  await page.getByRole('link', { name: 'My Account', exact: true }).click()
  await page.waitForURL(`${base}/account`)
  await page.screenshot({ path: '.local-checks/account-desktop.png' })
  await page.goto(`${base}/admin`)
  await page.getByText('Reviewer tools is not available online yet.', { exact: false }).waitFor()
  assert.equal(await page.getByText('Review queue.', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Sign Out', exact: true }).first().click()
  await page.getByRole('link', { name: 'Finish test logout' }).click()
  await page.getByRole('banner').getByRole('link', { name: 'Sign In', exact: true }).waitFor()
  assert.ok(logoutSeen)
  await page.goto(`${base}/signin?returnTo=${encodeURIComponent('//evil.test')}`)
  await page.getByRole('button', { name: 'Continue to Sign In' }).click()
  await page.getByRole('link', { name: 'Finish test login' }).click()
  await page.waitForURL(`${base}/account`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation', { name: 'Mobile', exact: true }).getByRole('link', { name: 'My Account' }).waitFor()
  await page.getByRole('navigation', { name: 'Mobile', exact: true }).getByRole('button', { name: 'Sign Out' }).waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: '.local-checks/account-mobile.png' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.getByRole('navigation', { name: 'Mobile', exact: true }).getByRole('link', { name: 'My Account' }).waitFor()
  await page.evaluate(() => {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key.startsWith('oidc.user:')) {
        const user = JSON.parse(sessionStorage.getItem(key))
        user.expires_at = 1
        sessionStorage.setItem(key, JSON.stringify(user))
      }
    }
  })
  await page.reload()
  await page.waitForURL(/\/signin\?returnTo=/)
  await page.getByRole('button', { name: 'Continue to Sign In' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Synthetic login/PKCE, action return, old-demo isolation, account navigation, hosted logout, unsafe return rejection, mobile navigation: passed')
} finally { await browser.close() }
