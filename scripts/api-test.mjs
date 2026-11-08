import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../backend/api/app.mjs'
import { RepositoryError } from '../backend/postgres/repository.mjs'
import {
  createReportResponse,
  handoffResponse,
  listPublicItemsResponse,
  markNotificationsReadResponse,
  myClaimsResponse,
  myReportsResponse,
  notificationsResponse,
  reviewClaimResponse,
  submitClaimResponse,
} from '../src/lib/contract/responses.ts'

const COMMUNITY = '11111111-1111-4111-8111-111111111111'
const ACTOR = '22222222-2222-4222-8222-222222222222'
const ITEM = '33333333-3333-4333-8333-333333333333'
const CLAIM = '44444444-4444-4444-8444-444444444444'

const publicRow = {
  id: ITEM,
  community_id: COMMUNITY,
  type: 'found',
  title: 'Blue umbrella',
  category: 'Accessories',
  description: 'Folded blue umbrella with a wooden handle near the plaza.',
  location: 'Barangay Hall',
  report_date: '2026-11-01',
  status: 'unclaimed',
  created_at: new Date('2026-11-01T08:00:00.000Z'),
}

function createFakeRepository(overrides = {}) {
  const calls = []
  const repository = {
    calls,
    ensureCommunity: async (name) => { calls.push(['ensureCommunity', name]); return COMMUNITY },
    ensureUser: async (input) => { calls.push(['ensureUser', input]); return ACTOR },
    listPublicReports: async (communityId, limit) => { calls.push(['listPublicReports', communityId, limit]); return [publicRow] },
    getPublicReport: async (communityId, id) => {
      calls.push(['getPublicReport', communityId, id])
      if (id !== ITEM) throw new RepositoryError('not_found', 'Report not found.')
      return publicRow
    },
    createReport: async (actorId, communityId, input) => {
      calls.push(['createReport', actorId, communityId, input])
      return ITEM
    },
    listMyReports: async (actorId) => { calls.push(['listMyReports', actorId]); return [{ ...publicRow, owner_id: ACTOR, owner_name: 'Ivan', reference_details: 'Scratched handle' }] },
    listMyClaims: async (actorId) => {
      calls.push(['listMyClaims', actorId])
      return [{
        id: CLAIM, item_id: ITEM, claimant_id: ACTOR, related_lost_report_id: null, statement: 'It is mine and here is why it matches.',
        contact_email: 'test@example.com', status: 'pending', reviewer_note: null,
        created_at: new Date('2026-11-01T09:00:00.000Z'), updated_at: new Date('2026-11-01T09:00:00.000Z'),
        item_title: 'Blue umbrella', claimant_name: 'Ivan',
        questions: [{ id: 'q1', question: 'Color?', answer: 'Blue' }],
      }]
    },
    listMatches: async (actorId, id) => { calls.push(['listMatches', actorId, id]); return [{ itemId: ITEM, score: 70 }] },
    listNotifications: async (actorId) => {
      calls.push(['listNotifications', actorId])
      return [{ id: 'n1', title: 'Claim submitted', message: 'Received', read_at: null, created_at: new Date('2026-11-01T09:00:00.000Z') }]
    },
    markNotificationsRead: async (actorId) => { calls.push(['markNotificationsRead', actorId]); return 1 },
    submitClaim: async (actorId, input) => { calls.push(['submitClaim', actorId, input]); return CLAIM },
    listReviewQueue: async (actorId, communityId, limit) => {
      calls.push(['listReviewQueue', actorId, communityId, limit])
      return [{ id: CLAIM, item_id: ITEM, claimant_id: ACTOR, status: 'pending', created_at: new Date('2026-11-01T09:00:00.000Z'), item_title: 'Blue umbrella', claimant_name: 'Ivan' }]
    },
    getReviewEvidence: async (actorId, claimId) => {
      calls.push(['getReviewEvidence', actorId, claimId])
      if (claimId !== CLAIM) throw new RepositoryError('not_found', 'Claim not found.')
      return {
        claim: { id: CLAIM, item_id: ITEM, claimant_id: ACTOR, status: 'approved', statement: 'Mine', contact_email: 'test@example.com', reviewer_note: 'Verified', created_at: new Date(), updated_at: new Date(), item_title: 'Blue umbrella', claimant_name: 'Ivan', related_lost_report_id: null },
        references: [{ report_id: ITEM, reference_details: 'Scratched handle' }],
        answers: [{ question_key: 'q1', question: 'Color?', answer: 'Blue' }],
      }
    },
    reviewClaim: async (actorId, claimId, input) => { calls.push(['reviewClaim', actorId, claimId, input]); return CLAIM },
    recordHandoff: async (actorId, input) => { calls.push(['recordHandoff', actorId, input]); return 'handoff-1' },
    ...overrides,
  }
  return repository
}

const verifyToken = async (token) => {
  if (token === 'admin-token') return { issuer: 'issuer', subject: 'admin-sub', name: 'Admin', email: 'admin@example.com', groups: ['admin'] }
  if (token === 'user-token') return { issuer: 'issuer', subject: 'user-sub', name: 'Ivan', email: 'ivan@example.com', groups: [] }
  throw new Error('invalid token')
}

const makeApp = (repository = createFakeRepository()) => createApp({
  repository,
  verifyToken,
  allowedOrigins: ['https://main.d2oswv5myenb38.amplifyapp.com'],
})

const request = (app, { method = 'GET', path, query = {}, headers = {}, body = '' }) => app({
  method,
  path,
  query,
  headers: { 'content-type': 'application/json', ...headers },
  body,
})

const auth = (token) => ({ authorization: `Bearer ${token}` })

test('public item list needs no token and exposes no private fields', async () => {
  const app = makeApp()
  const response = await request(app, { path: '/api/items' })
  assert.equal(response.status, 200)
  const body = JSON.parse(response.body)
  assert.equal(body.items.length, 1)
  assert.equal(body.items[0].title, 'Blue umbrella')
  for (const key of ['ownerId', 'ownerName', 'privateDetails', 'contactEmail', 'claimantId', 'claimantName', 'adminNote']) {
    assert.equal(key in body.items[0], false, `${key} must not be public`)
  }
})

test('public item list forwards validated discovery filters', async () => {
  const repository = createFakeRepository()
  const app = makeApp(repository)
  const response = await request(app, {
    path: '/api/items',
    query: { type: 'found', category: 'Accessories', location: 'Barangay Hall', from: '2026-01-01', to: 'not-a-date', q: 'umbrella', limit: '10' },
  })
  assert.equal(response.status, 200)
  const call = repository.calls.find(([name]) => name === 'listPublicReports')
  assert.deepEqual(call[2], {
    type: 'found', category: 'Accessories', location: 'Barangay Hall', from: '2026-01-01', to: undefined, q: 'umbrella', cursor: undefined, limit: 10,
  })
})

test('public item detail maps a missing report to 404', async () => {
  const app = makeApp()
  const missing = await request(app, { path: `/api/items/${'55555555-5555-4555-8555-555555555555'}` })
  assert.equal(missing.status, 404)
  assert.equal(JSON.parse(missing.body).error.code, 'not_found')
})

test('restricted routes require a bearer token', async () => {
  const app = makeApp()
  const missing = await request(app, { path: '/api/me/reports' })
  assert.equal(missing.status, 401)
  assert.equal(JSON.parse(missing.body).error.code, 'unauthorized')
  const invalid = await request(app, { path: '/api/me/reports', headers: auth('nope') })
  assert.equal(invalid.status, 401)
})

test('identity is derived from the token, not the request body', async () => {
  const repository = createFakeRepository()
  const app = makeApp(repository)
  const response = await request(app, { path: '/api/me/reports', headers: auth('user-token') })
  assert.equal(response.status, 200)
  const ensureUser = repository.calls.find(([name]) => name === 'ensureUser')
  assert.equal(ensureUser[1].subject, 'user-sub')
  assert.equal(ensureUser[1].isAdmin, false)
  const body = JSON.parse(response.body)
  assert.equal(body.items[0].ownerId, ACTOR)
  assert.equal(body.items[0].privateDetails, 'Scratched handle')
})

test('admin group maps to an admin membership', async () => {
  const repository = createFakeRepository()
  const app = makeApp(repository)
  await request(app, { path: '/api/admin/review-queue', headers: auth('admin-token') })
  const ensureUser = repository.calls.find(([name]) => name === 'ensureUser')
  assert.equal(ensureUser[1].isAdmin, true)
})

test('create report validates and returns the created id', async () => {
  const repository = createFakeRepository()
  const app = makeApp(repository)
  const body = JSON.stringify({
    type: 'lost', title: 'Black wallet', category: 'Wallets', location: 'Mall',
    description: 'Black leather wallet with two cards and a photo inside.',
    date: '2026-11-01', images: [],
  })
  const response = await request(app, { method: 'POST', path: '/api/reports', headers: auth('user-token'), body })
  assert.equal(response.status, 201)
  assert.equal(JSON.parse(response.body).itemId, ITEM)
  const call = repository.calls.find(([name]) => name === 'createReport')
  assert.equal(call[1], ACTOR)
})

test('invalid report input returns a validation error', async () => {
  const app = makeApp()
  const response = await request(app, {
    method: 'POST', path: '/api/reports', headers: auth('user-token'), body: JSON.stringify({ type: 'lost', title: 'x' }),
  })
  assert.equal(response.status, 422)
  assert.equal(JSON.parse(response.body).error.code, 'validation')
})

test('oversized bodies are rejected before parsing', async () => {
  const app = createApp({ repository: createFakeRepository(), verifyToken, maxBodyBytes: 32 })
  const response = await request(app, {
    method: 'POST', path: '/api/reports', headers: auth('user-token'), body: JSON.stringify({ padding: 'x'.repeat(64) }),
  })
  assert.equal(response.status, 413)
})

test('claim submission validates ownership answers', async () => {
  const app = makeApp()
  const invalid = await request(app, {
    method: 'POST', path: '/api/claims', headers: auth('user-token'),
    body: JSON.stringify({ itemId: ITEM, statement: 'short', contactEmail: 'bad', questions: [] }),
  })
  assert.equal(invalid.status, 422)
  const valid = await request(app, {
    method: 'POST', path: '/api/claims', headers: auth('user-token'),
    body: JSON.stringify({
      itemId: ITEM,
      statement: 'This umbrella is mine; it has my initials on the handle.',
      contactEmail: 'test@example.com',
      questions: [{ id: 'q1', question: 'Color?', answer: 'Blue' }],
    }),
  })
  assert.equal(valid.status, 201)
  assert.equal(JSON.parse(valid.body).claimId, CLAIM)
})

test('handoff requires an idempotency key', async () => {
  const app = makeApp()
  const body = JSON.stringify({ itemId: ITEM, claimId: CLAIM, note: 'Returned at the barangay hall desk.' })
  const missing = await request(app, { method: 'POST', path: '/api/admin/handoffs', headers: auth('admin-token'), body })
  assert.equal(missing.status, 422)
  const ok = await request(app, {
    method: 'POST', path: '/api/admin/handoffs',
    headers: { ...auth('admin-token'), 'idempotency-key': '66666666-6666-4666-8666-666666666666' }, body,
  })
  assert.equal(ok.status, 201)
  assert.equal(JSON.parse(ok.body).itemId, ITEM)
})

test('repository authorization errors map to the contract codes', async () => {
  const app = makeApp(createFakeRepository({
    listReviewQueue: async () => { throw new RepositoryError('forbidden', 'Reviewer access is required.') },
  }))
  const response = await request(app, { path: '/api/admin/review-queue', headers: auth('user-token') })
  assert.equal(response.status, 403)
  assert.equal(JSON.parse(response.body).error.code, 'forbidden')
})

test('unknown routes return a not_found error', async () => {
  const app = makeApp()
  const response = await request(app, { path: '/api/nope' })
  assert.equal(response.status, 404)
  assert.equal(JSON.parse(response.body).error.code, 'not_found')
})

test('CORS is limited to configured origins and preflight is handled', async () => {
  const app = makeApp()
  const allowed = await request(app, { method: 'OPTIONS', path: '/api/items', headers: { origin: 'https://main.d2oswv5myenb38.amplifyapp.com' } })
  assert.equal(allowed.status, 204)
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://main.d2oswv5myenb38.amplifyapp.com')
  const denied = await request(app, { method: 'OPTIONS', path: '/api/items', headers: { origin: 'https://evil.example' } })
  assert.equal(denied.headers['access-control-allow-origin'], undefined)
})

test('success responses match the shared contract schemas', async () => {
  const app = makeApp()
  const parse = (schema, response) => {
    assert.ok(response.status < 300, `unexpected status ${response.status}: ${response.body}`)
    const result = schema.safeParse(JSON.parse(response.body))
    assert.ok(result.success, JSON.stringify(result.error?.issues))
  }
  parse(listPublicItemsResponse, await request(app, { path: '/api/items' }))
  parse(myReportsResponse, await request(app, { path: '/api/me/reports', headers: auth('user-token') }))
  parse(myClaimsResponse, await request(app, { path: '/api/me/claims', headers: auth('user-token') }))
  parse(notificationsResponse, await request(app, { path: '/api/me/notifications', headers: auth('user-token') }))
  parse(markNotificationsReadResponse, await request(app, { method: 'POST', path: '/api/me/notifications/read', headers: auth('user-token') }))
  parse(createReportResponse, await request(app, {
    method: 'POST', path: '/api/reports', headers: auth('user-token'),
    body: JSON.stringify({
      type: 'lost', title: 'Black wallet', category: 'Wallets', location: 'Mall',
      description: 'Black leather wallet with two cards and a photo inside.', date: '2026-11-01', images: [],
    }),
  }))
  parse(submitClaimResponse, await request(app, {
    method: 'POST', path: '/api/claims', headers: auth('user-token'),
    body: JSON.stringify({
      itemId: ITEM, statement: 'This umbrella is mine; it has my initials on the handle.',
      contactEmail: 'test@example.com', questions: [{ id: 'q1', question: 'Color?', answer: 'Blue' }],
    }),
  }))
  parse(reviewClaimResponse, await request(app, {
    method: 'POST', path: `/api/admin/claims/${CLAIM}/review`, headers: auth('admin-token'),
    body: JSON.stringify({ decision: 'approved', note: 'Verified' }),
  }))
  parse(handoffResponse, await request(app, {
    method: 'POST', path: '/api/admin/handoffs',
    headers: { ...auth('admin-token'), 'idempotency-key': '77777777-7777-4777-8777-777777777777' },
    body: JSON.stringify({ itemId: ITEM, claimId: CLAIM, note: 'Returned at the barangay hall desk.' }),
  }))
})

test('health check is public', async () => {
  const app = makeApp()
  const response = await request(app, { path: '/health' })
  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(response.body), { ok: true })
})
