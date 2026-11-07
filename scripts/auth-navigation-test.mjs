import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeReturnTo, cognitoLogoutUrl } from '../src/lib/authNavigation.ts'

test('login return destinations preserve valid actions and reject external or looping redirects', () => {
  for (const path of ['/report?type=found', '/claim/item-1', '/dashboard?tab=claims', '/account']) assert.equal(safeReturnTo(path), path)
  for (const path of [undefined, '//evil.test', '/\\evil.test', 'https://evil.test', '/signin', '/%2f%2fevil.test', '/report\n']) assert.equal(safeReturnTo(path), '/account')
})
test('Cognito logout uses its hosted session endpoint and encoded allowed return URL', () => {
  const url = new URL(cognitoLogoutUrl('https://example.auth.ap-southeast-1.amazoncognito.com', 'test-client', 'http://localhost:5173/'))
  assert.equal(url.pathname, '/logout')
  assert.equal(url.searchParams.get('logout_uri'), 'http://localhost:5173/')
  assert.equal(url.searchParams.get('client_id'), 'test-client')
  assert.throws(() => cognitoLogoutUrl('http://example.test', 'client', '/'))
})
