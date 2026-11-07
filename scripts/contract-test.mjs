import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  API_ERROR_HTTP_STATUS,
  publicItemSchema,
  restrictedItemSchema,
} from '../src/lib/contract/index.ts'
import {
  createReport,
  getRestrictedItem,
  listMatches,
  listMyClaims,
  listMyNotifications,
  listMyReports,
  markAllNotificationsRead,
  migrateTraceData,
  recordHandoff,
  reviewClaim,
  submitClaim,
  toPublicItem,
} from '../src/lib/service/domain.ts'

const admin = { id: 'u_admin', name: 'Jordan Blake', email: 'admin@trace.app', role: 'admin' }
const alice = { id: 'u_alice', name: 'Alice', email: 'alice@example.com', role: 'user' }
const bob = { id: 'u_bob', name: 'Bob', email: 'bob@example.com', role: 'user' }
const finder = { id: 'u_staff', name: 'Library Desk', email: 'desk@example.com', role: 'user' }

const PRIVATE_KEYS = [
  'ownerId',
  'ownerName',
  'privateDetails',
  'contactEmail',
  'claimantId',
  'claimantName',
  'adminNote',
]

const foundItem = (over = {}) => ({
  id: 'item_found',
  type: 'found',
  title: 'Black Leather Wallet',
  category: 'Wallets & Cards',
  description:
    'A slim black bifold leather wallet found on a wooden bench near the library entrance.',
  location: 'University Library',
  date: '2026-11-01T00:00:00.000Z',
  status: 'unclaimed',
  images: ['/img/wallet.jpg'],
  ownerId: 'u_staff',
  ownerName: 'Library Front Desk',
  privateDetails: 'Finder phone: 555-0100',
  createdAt: '2026-11-01T02:00:00.000Z',
  timeline: [
    { id: 'tl1', label: 'Reported found', description: 'Submitted', date: '2026-11-01T02:00:00.000Z', done: true },
  ],
  ...over,
})

const lostItem = (over = {}) => ({
  id: 'item_lost',
  type: 'lost',
  title: 'Black Leather Wallet',
  category: 'Wallets & Cards',
  description: 'Lost my slim black bifold leather wallet near the library entrance last week.',
  location: 'University Library',
  date: '2026-11-01T00:00:00.000Z',
  status: 'active',
  images: [],
  ownerId: alice.id,
  ownerName: alice.name,
  privateDetails: 'Serial inside: W-9931',
  createdAt: '2026-11-01T03:00:00.000Z',
  timeline: [
    { id: 'tl1', label: 'Reported lost', description: 'Submitted', date: '2026-11-01T03:00:00.000Z', done: true },
  ],
  ...over,
})

const claim = (over = {}) => ({
  id: 'claim_1',
  itemId: 'item_found',
  itemTitle: 'Black Leather Wallet',
  claimantId: alice.id,
  claimantName: alice.name,
  statement: 'This is my wallet, I lost it near the library last week.',
  questions: [{ id: 'q1', question: 'Color?', answer: 'Black' }],
  status: 'pending',
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  contactEmail: alice.email,
  ...over,
})

const dataWith = (items, claims = [], notifications = [], audit = []) => ({
  items,
  claims,
  notifications,
  audit,
})

const reportInput = (over = {}) => ({
  type: 'found',
  title: 'Blue Water Bottle',
  category: 'Water Bottles',
  description: 'A blue stainless steel water bottle with a carabiner cap, lightly scratched.',
  location: 'Riverside Gym',
  date: '2020-01-01',
  images: [],
  ...over,
})

const claimInput = (itemId, over = {}) => ({
  itemId,
  statement: 'This item is mine, I lost it in that area earlier this month.',
  contactEmail: alice.email,
  questions: [{ id: 'q1', question: 'Color?', answer: 'Black' }],
  ...over,
})

function expectError(outcomeOrResult, code) {
  const result =
    outcomeOrResult && typeof outcomeOrResult === 'object' && 'result' in outcomeOrResult
      ? outcomeOrResult.result
      : outcomeOrResult
  assert.equal(result.ok, false, `expected failure with ${code}`)
  assert.equal(result.error.code, code)
  return result.error
}

/* ---- Public / restricted separation ---- */

test('public item responses never expose private fields', () => {
  const full = foundItem()
  const pub = toPublicItem(full)
  for (const key of PRIVATE_KEYS) {
    assert.ok(!(key in pub), `${key} leaked into the public item`)
  }
  const parsed = publicItemSchema.parse(full)
  for (const key of PRIVATE_KEYS) {
    assert.ok(!(key in parsed), `${key} survived schema parsing`)
  }
  for (const key of PRIVATE_KEYS) {
    assert.ok(!(key in publicItemSchema.shape), `${key} exists on the public schema`)
  }
  // The restricted schema is a separate shape that does carry owner fields.
  assert.ok('privateDetails' in restrictedItemSchema.shape)
  assert.ok('ownerId' in restrictedItemSchema.shape)
})

test('restricted item view is scoped to owner and admin', () => {
  const data = dataWith([foundItem()])
  const ownerView = getRestrictedItem(data, finder, 'item_found')
  assert.ok(ownerView.ok)
  assert.equal(ownerView.value.privateDetails, 'Finder phone: 555-0100')

  expectError(getRestrictedItem(data, bob, 'item_found'), 'not_found')
  expectError(getRestrictedItem(data, null, 'item_found'), 'unauthorized')
  expectError(getRestrictedItem(data, alice, 'missing'), 'not_found')
  assert.ok(getRestrictedItem(data, admin, 'item_found').ok)
})

test('my-reports, my-claims, and my-notifications only include the actor records', () => {
  const data = dataWith(
    [lostItem({ id: 'lost_a', ownerId: alice.id }), lostItem({ id: 'lost_b', ownerId: bob.id })],
    [claim({ id: 'c_alice', claimantId: alice.id }), claim({ id: 'c_bob', claimantId: bob.id })],
    [
      { id: 'n_alice', userId: alice.id, title: 'T', message: 'M', read: false, createdAt: '2026-11-02T00:00:00.000Z' },
      { id: 'n_bob', userId: bob.id, title: 'T', message: 'M', read: false, createdAt: '2026-11-02T00:00:00.000Z' },
    ],
  )

  assert.deepEqual(listMyReports(data, alice).value.map((item) => item.id), ['lost_a'])
  assert.deepEqual(listMyReports(data, bob).value.map((item) => item.id), ['lost_b'])
  assert.deepEqual(listMyClaims(data, alice).value.map((item) => item.id), ['c_alice'])
  assert.deepEqual(listMyNotifications(data, bob).value.map((item) => item.id), ['n_bob'])

  expectError(listMyReports(data, null), 'unauthorized')
  expectError(listMyClaims(data, null), 'unauthorized')
  expectError(listMyNotifications(data, null), 'unauthorized')
})

test('marking notifications read only touches the actor records', () => {
  const unreadAlice = { id: 'n_a', userId: alice.id, title: 'T', message: 'M', read: false, createdAt: '2026-11-02T00:00:00.000Z' }
  const unreadBob = { id: 'n_b', userId: bob.id, title: 'T', message: 'M', read: false, createdAt: '2026-11-02T00:00:00.000Z' }
  const data = dataWith([], [], [unreadAlice, unreadBob])

  const outcome = markAllNotificationsRead(data, alice)
  assert.ok(outcome.result.ok)
  assert.equal(outcome.result.value, 1)
  assert.equal(outcome.data.notifications[0].read, true)
  assert.equal(outcome.data.notifications[1].read, false)

  expectError(markAllNotificationsRead(data, null), 'unauthorized')
})

/* ---- Report creation ---- */

test('createReport takes identity from the actor, not the request body', () => {
  const data = dataWith([])
  expectError(createReport(data, null, reportInput()), 'unauthorized')
  expectError(createReport(data, alice, reportInput({ title: 'x' })), 'validation')

  const outcome = createReport(data, alice, reportInput({ ownerId: bob.id, ownerName: 'Mallory' }))
  assert.ok(outcome.result.ok)
  const item = outcome.data.items[0]
  assert.equal(item.ownerId, alice.id)
  assert.equal(item.ownerName, alice.name)
  assert.equal(item.status, 'unclaimed')
  assert.equal(outcome.data.audit[0].actor, alice.name)
  assert.equal(outcome.data.audit[0].action, 'item.reported')

  const lost = createReport(data, alice, reportInput({ type: 'lost' }))
  assert.equal(lost.data.items[0].status, 'active')
})

/* ---- Claims ---- */

test('submitClaim enforces eligibility, duplicates, and self-claim rules', () => {
  let data = dataWith([foundItem()])

  expectError(submitClaim(data, null, claimInput('item_found')), 'unauthorized')

  const first = submitClaim(data, alice, claimInput('item_found'))
  assert.ok(first.result.ok)
  data = first.data
  assert.equal(data.items[0].status, 'claim_pending')
  assert.equal(data.notifications[0].userId, alice.id)
  assert.equal(data.claims[0].itemTitle, 'Black Leather Wallet')

  expectError(submitClaim(data, alice, claimInput('item_found')), 'conflict')

  const bobClaim = submitClaim(data, bob, claimInput('item_found', { contactEmail: bob.email }))
  assert.ok(bobClaim.result.ok)
  data = bobClaim.data

  expectError(submitClaim(data, finder, claimInput('item_found')), 'conflict')
  expectError(submitClaim(data, alice, claimInput('missing_item')), 'conflict')

  const returned = dataWith([foundItem({ status: 'returned' })])
  expectError(submitClaim(returned, alice, claimInput('item_found')), 'conflict')

  const wrongType = dataWith([lostItem({ ownerId: finder.id })])
  expectError(submitClaim(wrongType, alice, claimInput('item_lost')), 'conflict')

  expectError(
    submitClaim(data, alice, claimInput('item_found', { statement: 'too short' })),
    'validation',
  )
  expectError(submitClaim(dataWith([foundItem()]), alice, claimInput('item_found', { statement: ' '.repeat(30) })), 'validation')
  expectError(submitClaim(dataWith([foundItem()]), alice, claimInput('item_found', { questions: [{ id: 'q', question: 'Detail?', answer: '   ' }] })), 'validation')

  const bobLost = lostItem({ id: 'lost_bob', ownerId: bob.id })
  expectError(
    submitClaim(dataWith([foundItem(), bobLost]), alice, claimInput('item_found', { relatedLostReportId: 'lost_bob' })),
    'conflict',
  )
})

test('a claim cannot be filed once an approval exists', () => {
  const data = dataWith(
    [foundItem({ status: 'awaiting_handoff' })],
    [claim({ status: 'approved' })],
  )
  expectError(submitClaim(data, alice, claimInput('item_found')), 'conflict')
})

test('linked reports must be the claimant’s active lost report', () => {
  for (const related of [lostItem({ status: 'returned' }), lostItem({ ownerId: bob.id }), foundItem({ id: 'item_lost' })]) {
    expectError(submitClaim(dataWith([foundItem(), related]), alice,
      claimInput('item_found', { relatedLostReportId: 'item_lost' })), 'conflict')
  }
  assert.ok(submitClaim(dataWith([foundItem(), lostItem()]), alice,
    claimInput('item_found', { relatedLostReportId: 'item_lost' })).result.ok)
})

/* ---- Review decisions ---- */

test('reviewClaim requires admin and blocks a second approval', () => {
  let data = dataWith(
    [foundItem()],
    [
      claim({ id: 'c_alice' }),
      claim({ id: 'c_bob', claimantId: bob.id, claimantName: bob.name, contactEmail: bob.email }),
    ],
  )

  expectError(reviewClaim(data, null, 'c_alice', { decision: 'approved' }), 'unauthorized')
  expectError(reviewClaim(data, bob, 'c_alice', { decision: 'approved' }), 'forbidden')
  expectError(reviewClaim(data, admin, 'c_missing', { decision: 'approved' }), 'conflict')

  const approved = reviewClaim(data, admin, 'c_alice', { decision: 'approved', note: 'Answers match' })
  assert.ok(approved.result.ok)
  data = approved.data
  assert.equal(data.claims.find((entry) => entry.id === 'c_alice').status, 'approved')
  assert.equal(data.items[0].status, 'awaiting_handoff')
  assert.equal(data.notifications[0].title, 'Claim approved')
  assert.equal(data.audit[0].action, 'claim.approved')

  const second = reviewClaim(data, admin, 'c_bob', { decision: 'approved' })
  expectError(second, 'conflict')
  assert.equal(second.data.claims.find((entry) => entry.id === 'c_bob').status, 'pending')

  expectError(reviewClaim(data, admin, 'c_alice', { decision: 'approved' }), 'conflict')
  expectError(reviewClaim(data, admin, 'c_alice', { decision: 'pending' }), 'validation')
})

test('administrators cannot review their own claims', () => {
  const own = claim({ claimantId: admin.id, claimantName: admin.name })
  const data = dataWith([foundItem()], [own])
  for (const decision of ['approved', 'rejected', 'under_review']) {
    expectError(reviewClaim(data, admin, own.id, { decision }), 'forbidden')
  }
  assert.ok(reviewClaim(data, { ...admin, id: 'another_admin' }, own.id, { decision: 'approved' }).result.ok)
})

test('one lost report cannot have approved claims on multiple found items', () => {
  const linked = lostItem()
  const first = claim({ id: 'first', relatedLostReportId: linked.id })
  const second = claim({ id: 'second', itemId: 'found_2', relatedLostReportId: linked.id })
  const data = dataWith([foundItem(), foundItem({ id: 'found_2' }), linked], [first, second])
  const approved = reviewClaim(data, admin, first.id, { decision: 'approved' })
  assert.ok(approved.result.ok)
  expectError(reviewClaim(approved.data, admin, second.id, { decision: 'approved' }), 'conflict')
  const closed = dataWith([foundItem(), lostItem({ status: 'returned' })], [first])
  expectError(reviewClaim(closed, admin, first.id, { decision: 'approved' }), 'conflict')
  assert.ok(reviewClaim(closed, admin, first.id, { decision: 'rejected' }).result.ok)
})

test('rejecting the only claim returns the item to unclaimed', () => {
  const outcome = reviewClaim(dataWith([foundItem()], [claim()]), admin, 'claim_1', {
    decision: 'rejected',
    note: 'No match',
  })
  assert.ok(outcome.result.ok)
  assert.equal(outcome.data.items[0].status, 'unclaimed')
  assert.equal(outcome.data.claims[0].status, 'rejected')
  assert.equal(outcome.data.notifications[0].title, 'Claim declined')
})

test('a returned item cannot receive further claim decisions', () => {
  const data = dataWith([foundItem({ status: 'returned' })], [claim({ status: 'approved' })])
  expectError(reviewClaim(data, admin, 'claim_1', { decision: 'rejected' }), 'conflict')
})

/* ---- Handoff ---- */

function approvedHandoffData(over = {}) {
  return dataWith(
    [foundItem({ status: 'awaiting_handoff' })],
    [claim({ status: 'approved', ...over.claim })],
    [],
  )
}

test('recordHandoff requires admin, an approved claim, and a real note', () => {
  const data = approvedHandoffData()

  expectError(recordHandoff(data, null, { itemId: 'item_found', claimId: 'claim_1', note: 'Handed over at desk' }), 'unauthorized')
  expectError(recordHandoff(data, bob, { itemId: 'item_found', claimId: 'claim_1', note: 'Handed over at desk' }), 'forbidden')
  expectError(recordHandoff(data, admin, { itemId: 'item_found', claimId: 'claim_1', note: 'ab' }), 'validation')
  expectError(recordHandoff(data, admin, { itemId: 'other', claimId: 'claim_1', note: 'Handed over at desk' }), 'conflict')

  const wrongState = dataWith([foundItem({ status: 'claim_pending' })], [claim({ status: 'approved' })])
  expectError(recordHandoff(wrongState, admin, { itemId: 'item_found', claimId: 'claim_1', note: 'Handed over at desk' }), 'conflict')

  const notApproved = dataWith([foundItem({ status: 'awaiting_handoff' })], [claim({ status: 'pending' })])
  expectError(recordHandoff(notApproved, admin, { itemId: 'item_found', claimId: 'claim_1', note: 'Handed over at desk' }), 'conflict')
})

test('recordHandoff returns the item, closes competing claims, and writes audit', () => {
  const data = dataWith(
    [foundItem({ status: 'awaiting_handoff' })],
    [
      claim({ status: 'approved' }),
      claim({ id: 'claim_2', claimantId: bob.id, claimantName: bob.name, contactEmail: bob.email }),
    ],
  )
  const note = 'Handed to Alice at the front desk on Nov 4, checked by staff'
  const outcome = recordHandoff(data, admin, { itemId: 'item_found', claimId: 'claim_1', note })
  assert.ok(outcome.result.ok)

  const items = outcome.data.items
  const claims = outcome.data.claims
  assert.equal(items[0].status, 'returned')
  assert.equal(items[0].timeline.at(-1).done, true)
  assert.equal(claims.find((entry) => entry.id === 'claim_2').status, 'rejected')
  assert.equal(claims.find((entry) => entry.id === 'claim_2').adminNote, 'Item returned to another verified claimant')
  assert.equal(outcome.data.notifications[0].title, 'Item returned')
  assert.equal(outcome.data.notifications[1].title, 'Claim closed')
  assert.equal(outcome.data.audit[0].action, 'handoff.confirmed')
  assert.ok(outcome.data.audit[0].detail.includes('Alice'))

  // The item is returned, so a retry cannot record a second handoff.
  expectError(
    recordHandoff(outcome.data, admin, { itemId: 'item_found', claimId: 'claim_1', note }),
    'conflict',
  )
})

test('handoff closes the claimant linked lost report', () => {
  const data = dataWith(
    [foundItem({ status: 'awaiting_handoff' }), lostItem({ id: 'lost_alice' })],
    [claim({ status: 'approved', relatedLostReportId: 'lost_alice' })],
  )
  const outcome = recordHandoff(data, admin, {
    itemId: 'item_found',
    claimId: 'claim_1',
    note: 'Handed to Alice at the front desk',
  })
  assert.ok(outcome.result.ok)
  const closed = outcome.data.items.find((item) => item.id === 'lost_alice')
  assert.equal(closed.status, 'returned')
  assert.equal(closed.timeline.at(-1).done, true)
})

test('handoff closes other pending claims linked to the returned lost report', () => {
  const linked = lostItem()
  const winner = claim({ id: 'winner', status: 'approved', relatedLostReportId: linked.id })
  const other = claim({ id: 'other', itemId: 'found_2', itemTitle: 'Another wallet', relatedLostReportId: linked.id })
  const unrelated = claim({ id: 'unrelated', itemId: 'found_3', claimantId: bob.id, claimantName: bob.name })
  const alsoOther = claim({ id: 'third', itemId: 'found_3', relatedLostReportId: linked.id })
  const data = dataWith([
    foundItem({ status: 'awaiting_handoff' }),
    foundItem({ id: 'found_2', status: 'claim_pending' }),
    foundItem({ id: 'found_3', status: 'claim_pending' }), linked,
  ], [winner, other, unrelated, alsoOther])
  const result = recordHandoff(data, admin, { itemId: 'item_found', claimId: 'winner', note: 'Handed over at the desk' })
  assert.ok(result.result.ok)
  assert.equal(result.data.items.find((item) => item.id === linked.id).status, 'returned')
  assert.equal(result.data.items.find((item) => item.id === 'found_2').status, 'unclaimed')
  assert.equal(result.data.items.find((item) => item.id === 'found_3').status, 'claim_pending')
  assert.equal(result.data.claims.find((entry) => entry.id === 'other').status, 'rejected')
  assert.equal(result.data.claims.find((entry) => entry.id === 'third').status, 'rejected')
  assert.equal(result.data.claims.find((entry) => entry.id === 'unrelated').status, 'pending')
  assert.equal(result.data.notifications.filter((entry) => entry.title === 'Claim closed').length, 2)
})

test('handoff rejects invalid or conflicting linked report state without mutations', () => {
  const winner = claim({ status: 'approved', relatedLostReportId: 'item_lost' })
  for (const data of [
    dataWith([foundItem({ status: 'awaiting_handoff' }), lostItem({ status: 'returned' })], [winner]),
    dataWith([foundItem({ status: 'awaiting_handoff' }), lostItem()], [winner, claim({ id: 'second', itemId: 'found_2', status: 'approved', relatedLostReportId: 'item_lost' })]),
  ]) {
    const outcome = recordHandoff(data, admin, { itemId: 'item_found', claimId: 'claim_1', note: 'Handed over at desk' })
    expectError(outcome, 'conflict')
    assert.equal(outcome.data, data)
  }
})

/* ---- Matching scope ---- */

test('matches are only visible for your own lost report', () => {
  const data = dataWith([lostItem({ id: 'lost_a', ownerId: alice.id }), foundItem()])

  expectError(listMatches(data, null, 'lost_a'), 'unauthorized')
  expectError(listMatches(data, bob, 'lost_a'), 'not_found')

  const own = listMatches(data, alice, 'lost_a')
  assert.ok(own.ok)
  assert.ok(own.value.length > 0)
  assert.equal(own.value[0].item.id, 'item_found')
})

/* ---- Persistence migration ---- */

test('legacy v1 browser records migrate to the current model', () => {
  const legacy = {
    items: [
      foundItem({ status: 'claim_under_review' }),
      foundItem({ id: 'item_bad', status: 'bogus_status' }),
      'not-an-object',
    ],
    claims: [claim()],
    notifications: [],
    audit: [],
  }
  const migrated = migrateTraceData(legacy)
  assert.equal(migrated.items.length, 1)
  assert.equal(migrated.items[0].status, 'awaiting_handoff')
  assert.equal(migrated.claims.length, 1)

  const current = { items: [foundItem()], claims: [], notifications: [], audit: [] }
  assert.equal(migrateTraceData(current).items[0].status, 'unclaimed')

  assert.equal(migrateTraceData({ items: 'nope' }), null)
  assert.equal(migrateTraceData(null), null)
  assert.equal(migrateTraceData('corrupt'), null)
})

/* ---- Error model ---- */

test('error codes map to stable HTTP statuses', () => {
  assert.equal(API_ERROR_HTTP_STATUS.unauthorized, 401)
  assert.equal(API_ERROR_HTTP_STATUS.forbidden, 403)
  assert.equal(API_ERROR_HTTP_STATUS.not_found, 404)
  assert.equal(API_ERROR_HTTP_STATUS.conflict, 409)
  assert.equal(API_ERROR_HTTP_STATUS.validation, 422)
  assert.equal(API_ERROR_HTTP_STATUS.service_unavailable, 503)
})
