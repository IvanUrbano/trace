import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadDemoData, loadDemoUser, saveDemoData, STORAGE_KEY, USER_STORAGE_KEY } from '../src/lib/persistence.ts'
import { createScannerSession } from '../src/lib/scannerSession.ts'
import { createCommunityPost, removeCommunityPost } from '../src/lib/community.ts'
import { migrateTraceData } from '../src/lib/service/domain.ts'

const empty = () => ({ items: [], claims: [], notifications: [], audit: [] })
function storageOf(values = {}) {
  const valuesMap = new Map(Object.entries(values))
  return { getItem: (key) => valuesMap.get(key) ?? null, setItem: (key, value) => valuesMap.set(key, value) }
}
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('corrupt nested records are rejected and their original storage is preserved', () => {
  for (const corrupt of [
    { ...empty(), claims: [{ id: 'broken', questions: null }] },
    { ...empty(), notifications: [{ read: 'yes' }] },
    { ...empty(), audit: [null] },
    { ...empty(), items: [{ status: 'unclaimed', timeline: 'broken' }] },
  ]) {
    const raw = JSON.stringify(corrupt)
    const storage = storageOf({ [STORAGE_KEY]: raw })
    assert.equal(migrateTraceData(corrupt), null)
    const loaded = loadDemoData(storage, empty())
    assert.ok(loaded.error)
    assert.equal(storage.getItem(STORAGE_KEY), raw)
  }
})

test('failed writes preserve the previous persisted snapshot and permit retry', () => {
  const storage = storageOf({ [STORAGE_KEY]: JSON.stringify(empty()) })
  const next = { ...empty(), audit: [{ id: 'a', actor: 'Tester', action: 'test', target: 'Test', timestamp: new Date().toISOString() }] }
  const previous = storage.getItem(STORAGE_KEY)
  assert.equal(saveDemoData({ ...storage, setItem() { throw new Error('QuotaExceededError') } }, next), false)
  assert.equal(storage.getItem(STORAGE_KEY), previous)
  assert.equal(saveDemoData(storage, next), true)
  assert.deepEqual(loadDemoData(storage, empty()).data, next)
})

test('malformed JSON and denied storage reads never overwrite saved records', () => {
  const storage = storageOf({ [STORAGE_KEY]: '{broken' })
  assert.ok(loadDemoData(storage, empty()).error)
  assert.equal(storage.getItem(STORAGE_KEY), '{broken')
  assert.ok(loadDemoData({ getItem() { throw new Error('Denied') } }, empty()).error)
})

test('legacy ambiguous user sessions must sign in again without changing reports', () => {
  const user = { id: 'u_demo', name: 'Other', email: 'other@example.com', role: 'user' }
  const storage = storageOf({ trace_state_v1_user: JSON.stringify(user) })
  assert.equal(loadDemoUser(storage), null)
  assert.equal(storage.getItem('trace_state_v1_user'), JSON.stringify(user))
  assert.equal(loadDemoUser(storageOf({ [USER_STORAGE_KEY]: JSON.stringify({ ...user, id: 'u_other@example.com' }) })).email, user.email)
  assert.equal(loadDemoUser(storageOf({ [USER_STORAGE_KEY]: JSON.stringify({ ...user, name: null }) })), null)
})

test('signed-out tombstone prevents a legacy session from reappearing', () => {
  const legacy = { id: 'u_demo', name: 'Alex', email: 'alex@example.com', role: 'user' }
  const storage = storageOf({ trace_state_v1_user: JSON.stringify(legacy) })
  assert.ok(loadDemoUser(storage))
  storage.setItem(USER_STORAGE_KEY, 'null')
  assert.equal(loadDemoUser(storage), null)
})

test('canceling during scanner import prevents camera creation', async () => {
  const imported = deferred()
  let created = 0
  const session = createScannerSession(() => imported.promise, () => assert.fail('stale decode'))
  const stopped = session.stop()
  imported.resolve(() => { created++; return {} })
  await stopped
  assert.equal(created, 0)
})

test('canceling during camera startup stops the eventual stream exactly once', async () => {
  const starting = deferred()
  const entered = deferred()
  let decoded
  let stops = 0
  let clears = 0
  const session = createScannerSession(async () => () => ({
    start: async (callback) => { decoded = callback; entered.resolve(); await starting.promise },
    stop: async () => { stops++ },
    clear: () => { clears++ },
  }), () => assert.fail('decode after close'))
  await entered.promise
  const stopped = session.stop()
  decoded('stale item URL')
  starting.resolve()
  await stopped
  await session.stop()
  assert.equal(stops, 1)
  assert.equal(clears, 1)
})

test('scanner startup failures release the scanner and remain retryable', async () => {
  let cleared = false
  const session = createScannerSession(async () => () => ({
    start: async () => { throw new Error('Permission denied') },
    stop: async () => assert.fail('not started'),
    clear: () => { cleared = true },
  }), () => {})
  await assert.rejects(session.ready, /Permission denied/)
  await session.stop()
  assert.ok(cleared)
})

test('an active scanner forwards a decode and stops on unmount cleanup', async () => {
  let decode
  let stops = 0
  const received = []
  const session = createScannerSession(async () => () => ({
    start: async (callback) => { decode = callback },
    stop: async () => { stops++ }, clear() {},
  }), (text) => received.push(text))
  await session.ready
  decode('/items/example')
  await session.stop()
  decode('/items/stale')
  assert.deepEqual(received, ['/items/example'])
  assert.equal(stops, 1)
})

const member = { id: 'm', name: 'Member', email: 'm@example.com', role: 'user' }
const admin = { id: 'a', name: 'Admin', email: 'a@example.com', role: 'admin' }
const draft = { title: 'Community update', body: 'Please use item reports for lost belongings.', category: 'Community update', authorId: 'spoofed' }

test('community posts require a signed-in actor and use actor identity', () => {
  const state = { version: 1, posts: [] }
  assert.equal(createCommunityPost(state, null, draft).error.code, 'unauthorized')
  const result = createCommunityPost(state, member, draft)
  assert.ok(result.ok)
  assert.equal(result.value.posts[0].authorId, member.id)
  assert.equal(result.value.posts[0].communityId, 'mandaluyong')
  assert.equal(createCommunityPost(state, member, { ...draft, title: ' ' }).error.code, 'validation')
  assert.equal(createCommunityPost(state, member, { ...draft, category: 'Announcement' }).error.code, 'forbidden')
  assert.ok(createCommunityPost(state, admin, { ...draft, category: 'Announcement' }).ok)
})

test('only the author or an admin can remove a community post', () => {
  const state = createCommunityPost({ version: 1, posts: [] }, member, draft).value
  const id = state.posts[0].id
  assert.equal(removeCommunityPost(state, { ...member, id: 'other' }, id).error.code, 'forbidden')
  assert.equal(removeCommunityPost(state, null, id).error.code, 'unauthorized')
  const removed = removeCommunityPost(state, admin, id)
  assert.ok(removed.ok)
  assert.equal(removed.value.posts[0].status, 'removed')
  assert.equal(state.posts[0].status, 'visible')
  assert.equal(removeCommunityPost(removed.value, member, id).error.code, 'not_found')
  assert.ok(removeCommunityPost(state, member, id).ok)
})
