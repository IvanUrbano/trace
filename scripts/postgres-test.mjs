import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, test } from 'node:test'
import pg from 'pg'
import { PostgresRepository } from '../backend/postgres/repository.mjs'

const url = process.env.TRACE_POSTGRES_TEST_URL
if (!url) throw new Error('Set TRACE_POSTGRES_TEST_URL to a dedicated, empty local test database.')
const target = new URL(url)
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !/^\/trace_test_[a-z0-9_]+$/.test(target.pathname)) {
  throw new Error('PostgreSQL tests require a loopback host and a dedicated database named trace_test_*.')
}
const pool = new pg.Pool({ connectionString: url, max: 10 })
after(async () => pool.end())
const existing = await pool.query("SELECT to_regnamespace('trace') AS schema")
if (existing.rows[0].schema) throw new Error('Test database is not empty: existing trace schema was left untouched.')
await pool.query(await readFile(new URL('../backend/postgres/001_initial.sql', import.meta.url), 'utf8'))
const repo = new PostgresRepository(pool)
const ids = Object.fromEntries(['community', 'otherCommunity', 'finder', 'alice', 'bob', 'reviewer', 'reviewer2'].map((name) => [name, randomUUID()]))
await pool.query('INSERT INTO trace.communities(id,name) VALUES($1,$2),($3,$4)', [ids.community, 'Test community', ids.otherCommunity, 'Other community'])
for (const name of ['finder', 'alice', 'bob', 'reviewer', 'reviewer2']) {
  await pool.query('INSERT INTO trace.users(id,identity_issuer,identity_subject,display_name) VALUES($1,$2,$3,$4)',
    [ids[name], 'test-issuer', name, name])
}
await pool.query(`INSERT INTO trace.community_memberships(community_id,user_id,role) VALUES
  ($1,$2,'reviewer'),($1,$3,'reviewer'),($1,$4,'reviewer'),($1,$5,'member')`,
[ids.community, ids.reviewer, ids.reviewer2, ids.alice, ids.bob])

const draft = (type, title, privateDetails = undefined) => ({
  type, title, category: 'Other', description: 'A distinctive test item found near the library entrance.',
  location: 'Test library', date: '2020-01-01', images: [], privateDetails,
})
const claimInput = (itemId, relatedLostReportId) => ({
  itemId, relatedLostReportId, statement: 'This is my item with a distinctive hidden marking.',
  contactEmail: 'example@example.test', questions: [{ id: 'q1', question: 'Which marking?', answer: 'Blue stripe' }],
})
const errorCode = (code) => (error) => error.code === code
const acceptRaceLoser = async (outcome, retry) => {
  assert.equal(outcome.status, 'rejected')
  assert.ok(['conflict', 'service_unavailable'].includes(outcome.reason.code))
  if (outcome.reason.code === 'service_unavailable') await assert.rejects(retry(), errorCode('conflict'))
}

test('reports persist while public views omit identity and private details', async () => {
  const report = await repo.createReport(ids.finder, ids.community, draft('found', 'Found test wallet', 'Private reference'))
  const listed = await repo.getPublicReport(ids.community, report)
  for (const key of ['owner_id', 'reference_details', 'contact_email', 'reviewer_note']) assert.ok(!(key in listed), key)
  assert.equal((await repo.listPublicReports(ids.otherCommunity)).length, 0)
  assert.equal((await repo.listMyReports(ids.finder)).find((item) => item.id === report).reference_details, 'Private reference')
  assert.equal((await repo.listMyReports(ids.bob)).length, 0)
  await assert.rejects(repo.getPublicReport(ids.otherCommunity, report), errorCode('not_found'))
  await assert.rejects(repo.submitClaim(ids.finder, claimInput(report)), errorCode('conflict'))
  await assert.rejects(repo.createReport(ids.finder, ids.community, { ...draft('found', 'Photo test'), images: ['data:image/jpeg;base64,AA=='] }), errorCode('validation'))
})

test('failed claim writes roll back claim, report status, and side effects', async () => {
  const found = await repo.createReport(ids.finder, ids.community, draft('found', 'Rollback fixture'))
  const input = claimInput(found)
  input.questions.push({ ...input.questions[0] })
  await assert.rejects(repo.submitClaim(ids.bob, input), errorCode('conflict'))
  const record = await pool.query('SELECT status FROM trace.reports WHERE id=$1', [found])
  const claims = await pool.query('SELECT count(*)::int AS count FROM trace.claims WHERE item_id=$1', [found])
  assert.equal(record.rows[0].status, 'unclaimed')
  assert.equal(claims.rows[0].count, 0)
})

test('restricted evidence is limited to community reviewers and self-review is denied', async () => {
  const found = await repo.createReport(ids.finder, ids.community, draft('found', 'Evidence found', 'Finder reference'))
  const lost = await repo.createReport(ids.alice, ids.community, draft('lost', 'Evidence lost', 'Owner detail'))
  const claim = await repo.submitClaim(ids.alice, claimInput(found, lost))
  await assert.rejects(repo.getReviewEvidence(ids.bob, claim), errorCode('forbidden'))
  await assert.rejects(repo.getReviewEvidence(ids.alice, claim), errorCode('forbidden'))
  await assert.rejects(repo.reviewClaim(ids.alice, claim, { decision: 'approved' }), errorCode('forbidden'))
  const evidence = await repo.getReviewEvidence(ids.reviewer, claim)
  assert.equal(evidence.answers[0].answer, 'Blue stripe')
  assert.deepEqual(new Set(evidence.references.map((row) => row.reference_details)), new Set(['Finder reference', 'Owner detail']))
  assert.equal((await repo.listMyClaims(ids.alice)).find((item) => item.id === claim).questions[0].answer, 'Blue stripe')
  assert.equal((await repo.listMyClaims(ids.bob)).length, 0)
  assert.ok((await repo.listReviewQueue(ids.reviewer, ids.community)).some((entry) => entry.id === claim))
  await assert.rejects(repo.listReviewQueue(ids.bob, ids.community), errorCode('forbidden'))
  const otherFound = await repo.createReport(ids.finder, ids.otherCommunity, draft('found', 'Other community fixture'))
  const otherClaim = await repo.submitClaim(ids.bob, claimInput(otherFound))
  await assert.rejects(repo.getReviewEvidence(ids.reviewer, otherClaim), errorCode('forbidden'))
  await assert.rejects(repo.reviewClaim(ids.reviewer, otherClaim, { decision: 'approved' }), errorCode('forbidden'))
})

test('matching uses public fields, is owner-scoped, and stays within the community', async () => {
  const lost = await repo.createReport(ids.alice, ids.community, draft('lost', 'Blue leather wallet', 'Hidden owner proof'))
  const found = await repo.createReport(ids.finder, ids.community, draft('found', 'Blue leather wallet', 'Hidden finder reference'))
  const elsewhere = await repo.createReport(ids.finder, ids.otherCommunity, draft('found', 'Blue leather wallet', 'Other community secret'))
  await assert.rejects(repo.listMatches(ids.bob, lost), errorCode('not_found'))
  const matches = await repo.listMatches(ids.alice, lost)
  assert.ok(matches.some((match) => match.item.id === found))
  assert.ok(matches.every((match) => match.item.id !== elsewhere))
  assert.ok(!JSON.stringify(matches).includes('Hidden'))
})

test('concurrent approvals for one found item yield only one winner', async () => {
  const found = await repo.createReport(ids.finder, ids.community, draft('found', 'Concurrent found'))
  const c1 = await repo.submitClaim(ids.alice, claimInput(found))
  const c2 = await repo.submitClaim(ids.bob, claimInput(found))
  const decisions = await Promise.allSettled([
    repo.reviewClaim(ids.reviewer, c1, { decision: 'approved' }),
    repo.reviewClaim(ids.reviewer2, c2, { decision: 'approved' }),
  ])
  assert.equal(decisions.filter((entry) => entry.status === 'fulfilled').length, 1)
  const loserIndex = decisions.findIndex((entry) => entry.status === 'rejected')
  await acceptRaceLoser(decisions[loserIndex], () => repo.reviewClaim(loserIndex ? ids.reviewer2 : ids.reviewer, loserIndex ? c2 : c1, { decision: 'approved' }))
  const approved = await pool.query("SELECT count(*)::int AS count FROM trace.claims WHERE item_id=$1 AND status='approved'", [found])
  assert.equal(approved.rows[0].count, 1)
})

test('database constraints reject invalid links and duplicate approvals independently of the repository', async () => {
  const lost = await repo.createReport(ids.alice, ids.community, draft('lost', 'Constraint lost'))
  const found1 = await repo.createReport(ids.finder, ids.community, draft('found', 'Constraint found one'))
  const found2 = await repo.createReport(ids.finder, ids.community, draft('found', 'Constraint found two'))
  const approved = randomUUID()
  const insert = `INSERT INTO trace.claims(id,item_id,claimant_id,related_lost_report_id,statement,contact_email,status)
    VALUES($1,$2,$3,$4,$5,$6,$7)`
  const statement = 'This item has a distinctive private test marking.'
  const email = 'claimant@example.test'
  await pool.query(insert, [approved, found1, ids.alice, lost, statement, email, 'approved'])
  await assert.rejects(pool.query(insert, [randomUUID(), found1, ids.bob, null, statement, email, 'approved']), (error) => error.code === '23505')
  await assert.rejects(pool.query(insert, [randomUUID(), found2, ids.alice, lost, statement, email, 'approved']), (error) => error.code === '23505')
  await assert.rejects(pool.query(insert, [randomUUID(), found2, ids.bob, lost, statement, email, 'pending']), (error) => error.code === '23503')
  await assert.rejects(pool.query(`INSERT INTO trace.handoffs(claim_id,found_item_id,recorded_by,recipient_id,idempotency_key,note)
    VALUES($1,$2,$3,$4,$5,$6)`, [approved, found1, ids.reviewer, ids.bob, randomUUID(), 'Wrong recipient test']), (error) => error.code === '23503')
})

test('linked approvals and handoff are atomic, scoped, and retryable', async () => {
  const lost = await repo.createReport(ids.alice, ids.community, draft('lost', 'Linked lost fixture', 'Private lost detail'))
  const found1 = await repo.createReport(ids.finder, ids.community, draft('found', 'Linked found one'))
  const found2 = await repo.createReport(ids.finder, ids.community, draft('found', 'Linked found two'))
  const c1 = await repo.submitClaim(ids.alice, claimInput(found1, lost))
  const c2 = await repo.submitClaim(ids.alice, claimInput(found2, lost))
  const decisions = await Promise.allSettled([
    repo.reviewClaim(ids.reviewer, c1, { decision: 'approved' }),
    repo.reviewClaim(ids.reviewer2, c2, { decision: 'approved' }),
  ])
  const winningIndex = decisions.findIndex((entry) => entry.status === 'fulfilled')
  assert.ok(winningIndex >= 0)
  assert.equal(decisions.filter((entry) => entry.status === 'fulfilled').length, 1)
  const losingIndex = 1 - winningIndex
  await acceptRaceLoser(decisions[losingIndex], () => repo.reviewClaim(losingIndex ? ids.reviewer2 : ids.reviewer, losingIndex ? c2 : c1, { decision: 'approved' }))
  const winner = winningIndex ? c2 : c1
  const winningFound = winningIndex ? found2 : found1
  const alternativeFound = winningIndex ? found1 : found2
  const alternateClaim = winningIndex ? c1 : c2
  const handoff = { itemId: winningFound, claimId: winner, note: 'Handed over at the demo office', idempotencyKey: randomUUID() }
  await assert.rejects(repo.recordHandoff(ids.bob, handoff), errorCode('forbidden'))
  const attempts = await Promise.allSettled([repo.recordHandoff(ids.reviewer, handoff), repo.recordHandoff(ids.reviewer, handoff)])
  const completed = attempts.find((attempt) => attempt.status === 'fulfilled')
  assert.ok(completed, 'at least one handoff attempt must succeed')
  const id = completed.value
  for (const attempt of attempts) {
    if (attempt.status === 'rejected') assert.equal(attempt.reason.code, 'service_unavailable')
    else assert.equal(attempt.value, id)
  }
  assert.equal(await repo.recordHandoff(ids.reviewer, handoff), id)
  await pool.query("UPDATE trace.community_memberships SET role='member' WHERE community_id=$1 AND user_id=$2", [ids.community, ids.reviewer])
  await assert.rejects(repo.recordHandoff(ids.reviewer, handoff), errorCode('forbidden'))
  await pool.query("UPDATE trace.community_memberships SET role='reviewer' WHERE community_id=$1 AND user_id=$2", [ids.community, ids.reviewer])
  await assert.rejects(repo.recordHandoff(ids.reviewer, { ...handoff, note: 'A different handoff note' }), errorCode('conflict'))
  await assert.rejects(repo.recordHandoff(ids.reviewer, { ...handoff, idempotencyKey: randomUUID() }), errorCode('conflict'))
  const reports = await pool.query('SELECT id,status FROM trace.reports WHERE id=ANY($1::uuid[])', [[lost, winningFound, alternativeFound]])
  const statuses = Object.fromEntries(reports.rows.map((row) => [row.id, row.status]))
  assert.equal(statuses[lost], 'returned')
  assert.equal(statuses[winningFound], 'returned')
  assert.equal(statuses[alternativeFound], 'unclaimed')
  assert.equal((await pool.query('SELECT status FROM trace.claims WHERE id=$1', [alternateClaim])).rows[0].status, 'rejected')
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM trace.handoffs WHERE claim_id=$1', [winner])).rows[0].count, 1)
  await assert.rejects(pool.query(`INSERT INTO trace.handoffs (claim_id,found_item_id,recorded_by,recipient_id,idempotency_key,note)
    VALUES ($1,$2,$3,$4,$5,$6)`, [winner, winningFound, ids.reviewer2, ids.bob, randomUUID(), 'Wrong recipient test']), (error) => ['23503', '23505'].includes(error.code))
})

test('notifications are scoped to their user', async () => {
  const aliceNotifications = await repo.listNotifications(ids.alice)
  assert.ok(aliceNotifications.length > 0)
  const unreadBobBefore = await pool.query('SELECT count(*)::int AS count FROM trace.notifications WHERE user_id=$1 AND read_at IS NULL', [ids.bob])
  assert.ok(await repo.markNotificationsRead(ids.alice) > 0)
  assert.equal(await repo.markNotificationsRead(ids.alice), 0)
  const unreadBobAfter = await pool.query('SELECT count(*)::int AS count FROM trace.notifications WHERE user_id=$1 AND read_at IS NULL', [ids.bob])
  assert.equal(unreadBobAfter.rows[0].count, unreadBobBefore.rows[0].count)
})
