import { z } from 'zod'
import { createReportRequest, submitClaimRequest, reviewClaimRequest, handoffRequest } from '../../src/lib/contract/requests.ts'
import { rankFoundMatches } from '../../src/lib/matching.ts'

/** Server-only repository. actorId MUST come from a verified server session.
 * This module does not authenticate callers and must never be exposed directly
 * to a browser or used as a production API before identity verification exists.
 */
export class RepositoryError extends Error {
  constructor(code, message, retryable = false) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
    this.retryable = retryable
  }
}

const fail = (code, message, retryable = false) => { throw new RepositoryError(code, message, retryable) }
const isUuid = (value) => typeof value === 'string' && z.uuid().safeParse(value).success
const requireUuid = (value, label) => { if (!isUuid(value)) fail('validation', `Invalid ${label}.`) }
const parsed = (schema, value) => {
  const result = schema.safeParse(value)
  if (!result.success) fail('validation', result.error.issues[0]?.message || 'Invalid request.')
  return result.data
}

async function transaction(pool, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error instanceof RepositoryError) throw error
    if (error.code === '23505') fail('conflict', 'The requested change conflicts with an existing record.')
    if (error.code === '23503' || error.code === '23514' || error.code === '22007' || error.code === '22008') {
      fail('validation', 'The request contains invalid or unavailable data.')
    }
    if (error.code === '40001' || error.code === '40P01') fail('service_unavailable', 'A concurrent update occurred. Retry the request.', true)
    throw error
  } finally { client.release() }
}

async function reviewer(client, actorId, communityId) {
  const result = await client.query(
    `SELECT 1 FROM trace.community_memberships WHERE user_id = $1 AND community_id = $2 AND role IN ('reviewer', 'admin')`,
    [actorId, communityId],
  )
  if (!result.rowCount) fail('forbidden', 'Reviewer access is required.')
}

async function claimSnapshot(client, claimId) {
  const result = await client.query(`
    SELECT c.*, r.community_id, r.title AS item_title, r.owner_id AS finder_id,
      r.status AS item_status, r.type AS report_type, u.display_name AS claimant_name
    FROM trace.claims c
    JOIN trace.reports r ON r.id = c.item_id
    JOIN trace.users u ON u.id = c.claimant_id
    WHERE c.id = $1`, [claimId])
  if (!result.rowCount) fail('not_found', 'Claim not found.')
  return result.rows[0]
}

async function lockReports(client, ids) {
  return (await client.query(
    'SELECT * FROM trace.reports WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
    [[...new Set(ids.filter(Boolean))]],
  )).rows
}

function assertRelatedAvailable(reports, claim) {
  if (!claim.related_lost_report_id) return
  const lost = reports.find((report) => report.id === claim.related_lost_report_id)
  if (!lost || lost.type !== 'lost' || lost.owner_id !== claim.claimant_id || lost.status !== 'active') {
    fail('conflict', 'The linked lost report is no longer active.')
  }
}

function validClaimInput(input) {
  // Bound collection/string sizes before Zod parsing; the HTTP layer also caps body size.
  if (!input || typeof input !== 'object' || !Array.isArray(input.questions) || input.questions.length > 32 ||
      input.questions.some((q) => !q || typeof q !== 'object' ||
        [q.id, q.question, q.answer].some((value) => typeof value !== 'string' || value.length > 5000)) ||
      typeof input.statement !== 'string' || input.statement.length > 5000 ||
      typeof input.contactEmail !== 'string' || input.contactEmail.length > 320) {
    fail('validation', 'Claim data is invalid or too large.')
  }
  const draft = parsed(submitClaimRequest, input)
  requireUuid(draft.itemId, 'found report ID')
  if (draft.relatedLostReportId) requireUuid(draft.relatedLostReportId, 'lost report ID')
  return draft
}

export class PostgresRepository {
  constructor(pool) { this.pool = pool }

  async ensureCommunity(name) {
    if (typeof name !== 'string' || !name.trim() || name.length > 120) fail('validation', 'Invalid community name.')
    const trimmed = name.trim()
    return transaction(this.pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('trace.community'))")
      const existing = await client.query('SELECT id FROM trace.communities WHERE name=$1 ORDER BY created_at,id LIMIT 1', [trimmed])
      if (existing.rowCount) return existing.rows[0].id
      const created = await client.query('INSERT INTO trace.communities (name) VALUES ($1) RETURNING id', [trimmed])
      return created.rows[0].id
    })
  }

  /** Maps a verified identity (issuer + subject) to a local user and membership. */
  async ensureUser({ issuer, subject, displayName, communityId, isAdmin = false }) {
    if (typeof issuer !== 'string' || !issuer.trim() || issuer.length > 500) fail('validation', 'Invalid identity issuer.')
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 200) fail('validation', 'Invalid identity subject.')
    requireUuid(communityId, 'community ID')
    const name = (typeof displayName === 'string' && displayName.trim() ? displayName.trim() : 'TRACE member').slice(0, 120)
    return transaction(this.pool, async (client) => {
      const upsert = await client.query(`
        INSERT INTO trace.users (identity_issuer, identity_subject, display_name)
        VALUES ($1,$2,$3)
        ON CONFLICT (identity_issuer, identity_subject) DO UPDATE SET display_name=EXCLUDED.display_name
        RETURNING id`, [issuer.trim(), subject.trim(), name])
      const userId = upsert.rows[0].id
      await client.query(`
        INSERT INTO trace.community_memberships (community_id, user_id, role)
        VALUES ($1,$2,$3)
        ON CONFLICT (community_id, user_id) DO UPDATE
          SET role=CASE WHEN EXCLUDED.role='admin' THEN 'admin' ELSE trace.community_memberships.role END`,
      [communityId, userId, isAdmin ? 'admin' : 'member'])
      return userId
    })
  }

  async listPublicReports(communityId, options = 20) {
    requireUuid(communityId, 'community ID')
    const filters = typeof options === 'number' ? { limit: options } : (options || {})
    const limit = filters.limit ?? 20
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) fail('validation', 'Limit must be between 1 and 50.')
    const conditions = ['community_id = $1']
    const values = [communityId]
    if (filters.type) { values.push(filters.type); conditions.push(`type = $${values.length}`) }
    if (filters.category) { values.push(filters.category); conditions.push(`category = $${values.length}`) }
    if (filters.location) { values.push(filters.location); conditions.push(`lower(btrim(location)) = lower(btrim($${values.length}))`) }
    if (filters.from) { values.push(filters.from); conditions.push(`report_date >= $${values.length}::date`) }
    if (filters.to) { values.push(filters.to); conditions.push(`report_date <= $${values.length}::date`) }
    if (filters.q) {
      values.push(`%${filters.q.replace(/[%_\\]/g, '\\$&')}%`)
      conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`)
    }
    values.push(limit)
    const result = await this.pool.query(`
      SELECT id, community_id, type, title, category, description, location,
        report_date::text AS report_date, status, created_at
      FROM trace.public_reports WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC, id DESC LIMIT $${values.length}`, values)
    return result.rows
  }

  async getPublicReport(communityId, reportId) {
    requireUuid(communityId, 'community ID'); requireUuid(reportId, 'report ID')
    const result = await this.pool.query(`SELECT id, community_id, type, title, category, description, location,
      report_date::text AS report_date, status, created_at FROM trace.public_reports
      WHERE community_id=$1 AND id=$2`, [communityId, reportId])
    if (!result.rowCount) fail('not_found', 'Report not found.')
    return result.rows[0]
  }

  async listMyReports(actorId) {
    requireUuid(actorId, 'actor ID')
    const result = await this.pool.query(`SELECT r.id, r.community_id, r.owner_id, r.type, r.title, r.category,
      r.description, r.location, r.report_date::text AS report_date, r.status, r.created_at, p.reference_details,
      u.display_name AS owner_name
      FROM trace.reports r LEFT JOIN trace.report_private_details p ON p.report_id=r.id
      LEFT JOIN trace.users u ON u.id=r.owner_id
      WHERE r.owner_id=$1 ORDER BY r.created_at DESC,r.id DESC`, [actorId])
    return result.rows
  }

  async listMyClaims(actorId) {
    requireUuid(actorId, 'actor ID')
    const result = await this.pool.query(`SELECT c.id,c.item_id,c.related_lost_report_id,c.statement,c.contact_email,c.status,
      c.reviewer_note,c.created_at,c.updated_at,r.title AS item_title,u.display_name AS claimant_name,
      COALESCE(jsonb_agg(jsonb_build_object('id',a.question_key,'question',a.question,'answer',a.answer)
        ORDER BY a.question_key) FILTER (WHERE a.question_key IS NOT NULL), '[]'::jsonb) AS questions
      FROM trace.claims c
      LEFT JOIN trace.claim_answers a ON a.claim_id=c.id
      JOIN trace.reports r ON r.id=c.item_id
      JOIN trace.users u ON u.id=c.claimant_id
      WHERE c.claimant_id=$1 GROUP BY c.id,r.title,u.display_name ORDER BY c.created_at DESC,c.id DESC`, [actorId])
    return result.rows
  }

  async listNotifications(actorId) {
    requireUuid(actorId, 'actor ID')
    const result = await this.pool.query('SELECT id,title,message,read_at,created_at FROM trace.notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC', [actorId])
    return result.rows
  }

  async markNotificationsRead(actorId) {
    requireUuid(actorId, 'actor ID')
    const result = await this.pool.query('UPDATE trace.notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [actorId])
    return result.rowCount
  }

  async listReviewQueue(actorId, communityId, limit = 50) {
    requireUuid(actorId, 'actor ID'); requireUuid(communityId, 'community ID')
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) fail('validation', 'Limit must be between 1 and 50.')
    return transaction(this.pool, async (client) => {
      await reviewer(client, actorId, communityId)
      const result = await client.query(`SELECT c.id,c.item_id,c.claimant_id,c.status,c.created_at,
        r.title AS item_title,u.display_name AS claimant_name
        FROM trace.claims c JOIN trace.reports r ON r.id=c.item_id JOIN trace.users u ON u.id=c.claimant_id
        WHERE r.community_id=$1 AND c.status IN ('pending','under_review')
        ORDER BY c.created_at,c.id LIMIT $2`, [communityId, limit])
      return result.rows
    })
  }

  async listMatches(actorId, lostReportId) {
    requireUuid(actorId, 'actor ID'); requireUuid(lostReportId, 'lost report ID')
    const lostResult = await this.pool.query(`SELECT id,community_id,type,title,category,description,location,
      report_date::text AS date,status FROM trace.reports WHERE id=$1 AND owner_id=$2 AND type='lost'`, [lostReportId, actorId])
    if (!lostResult.rowCount) fail('not_found', 'Report not found.')
    const lost = lostResult.rows[0]
    if (lost.status === 'returned') return []
    // Bound candidate retrieval; matching only receives public title/description and metadata.
    const candidates = await this.pool.query(`SELECT id,type,title,category,description,location,
      report_date::text AS date,status FROM trace.public_reports
      WHERE community_id=$1 AND type='found' AND status<>'returned' AND category=$2
      ORDER BY created_at DESC,id DESC LIMIT 200`, [lost.community_id, lost.category])
    return rankFoundMatches(lost, candidates.rows)
  }

  async createReport(actorId, communityId, input) {
    requireUuid(actorId, 'actor ID'); requireUuid(communityId, 'community ID')
    if (!input || typeof input !== 'object' || !Array.isArray(input.images) || input.images.length > 4 ||
      ['title', 'category', 'description', 'location', 'date'].some((key) => typeof input[key] !== 'string' || input[key].length > 5000) ||
      (input.privateDetails !== undefined && (typeof input.privateDetails !== 'string' || input.privateDetails.length > 5000))) {
      fail('validation', 'Report data is invalid or too large.')
    }
    const draft = parsed(createReportRequest, input)
    if (draft.images.length) fail('validation', 'Photo uploads are not connected to this repository yet.')
    return transaction(this.pool, async (client) => {
      const result = await client.query(`
        INSERT INTO trace.reports (community_id, owner_id, type, title, category, description, location, report_date, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [communityId, actorId, draft.type, draft.title.trim(), draft.category.trim(), draft.description.trim(), draft.location.trim(), draft.date,
        draft.type === 'lost' ? 'active' : 'unclaimed'])
      const id = result.rows[0].id
      if (draft.privateDetails?.trim()) await client.query('INSERT INTO trace.report_private_details (report_id, reference_details) VALUES ($1,$2)', [id, draft.privateDetails.trim()])
      await client.query('INSERT INTO trace.report_timeline (report_id, label, description, done) VALUES ($1,$2,$3,true)', [id, `Reported ${draft.type}`, 'Report submitted'])
      await client.query('INSERT INTO trace.audit_events (actor_id, action, target_id) VALUES ($1,$2,$3)', [actorId, 'item.reported', id])
      return id
    })
  }

  async submitClaim(actorId, input) {
    requireUuid(actorId, 'actor ID')
    const draft = validClaimInput(input)
    return transaction(this.pool, async (client) => {
      const reports = await lockReports(client, [draft.itemId, draft.relatedLostReportId])
      const found = reports.find((report) => report.id === draft.itemId)
      if (!found || found.type !== 'found' || !['unclaimed', 'claim_pending'].includes(found.status) || found.owner_id === actorId) {
        fail('conflict', 'This item is not available for a new claim.')
      }
      assertRelatedAvailable(reports, { related_lost_report_id: draft.relatedLostReportId, claimant_id: actorId })
      const approved = await client.query("SELECT 1 FROM trace.claims WHERE item_id=$1 AND status='approved'", [draft.itemId])
      if (approved.rowCount) fail('conflict', 'This item is not available for a new claim.')
      const result = await client.query(`
        INSERT INTO trace.claims (item_id, claimant_id, related_lost_report_id, statement, contact_email)
        VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [draft.itemId, actorId, draft.relatedLostReportId || null, draft.statement, draft.contactEmail])
      const id = result.rows[0].id
      for (const answer of draft.questions) await client.query(
        'INSERT INTO trace.claim_answers (claim_id,question_key,question,answer) VALUES ($1,$2,$3,$4)',
        [id, answer.id, answer.question, answer.answer],
      )
      await client.query("UPDATE trace.reports SET status='claim_pending', updated_at=now() WHERE id=$1", [draft.itemId])
      await client.query('INSERT INTO trace.notifications (user_id,title,message) VALUES ($1,$2,$3)', [actorId, 'Claim submitted', 'Your claim was received.'])
      await client.query('INSERT INTO trace.audit_events (actor_id,action,target_id) VALUES ($1,$2,$3)', [actorId, 'claim.submitted', id])
      return id
    })
  }

  async getReviewEvidence(actorId, claimId) {
    requireUuid(actorId, 'actor ID'); requireUuid(claimId, 'claim ID')
    return transaction(this.pool, async (client) => {
      const claim = await claimSnapshot(client, claimId)
      await reviewer(client, actorId, claim.community_id)
      if (claim.claimant_id === actorId) fail('forbidden', 'A different reviewer must handle your claim.')
      const references = await client.query('SELECT report_id, reference_details FROM trace.report_private_details WHERE report_id=ANY($1::uuid[])', [[claim.item_id, claim.related_lost_report_id].filter(Boolean)])
      const answers = await client.query('SELECT question_key, question, answer FROM trace.claim_answers WHERE claim_id=$1 ORDER BY question_key', [claimId])
      return { claim, references: references.rows, answers: answers.rows }
    })
  }

  async reviewClaim(actorId, claimId, input) {
    requireUuid(actorId, 'actor ID'); requireUuid(claimId, 'claim ID')
    if (!input || typeof input !== 'object' || (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 2000))) {
      fail('validation', 'Review data is invalid or too large.')
    }
    const draft = parsed(reviewClaimRequest, input)
    return transaction(this.pool, async (client) => {
      let claim = await claimSnapshot(client, claimId)
      await reviewer(client, actorId, claim.community_id)
      if (claim.claimant_id === actorId) fail('forbidden', 'A different reviewer must handle your claim.')
      const reports = await lockReports(client, [claim.item_id, claim.related_lost_report_id])
      await client.query('SELECT id FROM trace.claims WHERE id=$1 FOR UPDATE', [claimId])
      claim = await claimSnapshot(client, claimId)
      if (claim.report_type !== 'found' || claim.item_status === 'returned' ||
        !['pending', 'under_review'].includes(claim.status) || claim.status === draft.decision) {
        fail('conflict', 'This claim cannot be updated.')
      }
      if (draft.decision === 'approved') {
        assertRelatedAvailable(reports, claim)
        const conflict = await client.query(`SELECT 1 FROM trace.claims WHERE id<>$1 AND status='approved'
          AND (item_id=$2 OR (related_lost_report_id IS NOT NULL AND related_lost_report_id=$3))`,
        [claimId, claim.item_id, claim.related_lost_report_id])
        if (conflict.rowCount) fail('conflict', 'Another claim is already approved.')
      }
      await client.query('UPDATE trace.claims SET status=$2,reviewer_note=$3,updated_at=now() WHERE id=$1', [claimId, draft.decision, draft.note || null])
      if (draft.decision === 'approved') {
        await client.query("UPDATE trace.reports SET status='awaiting_handoff',updated_at=now() WHERE id=$1", [claim.item_id])
      } else if (draft.decision === 'rejected') {
        await client.query(`UPDATE trace.reports SET status='unclaimed',updated_at=now() WHERE id=$1 AND status='claim_pending'
          AND NOT EXISTS (SELECT 1 FROM trace.claims WHERE item_id=$1 AND status IN ('pending','under_review','approved'))`, [claim.item_id])
      }
      await client.query('INSERT INTO trace.notifications (user_id,title,message) VALUES ($1,$2,$3)',
        [claim.claimant_id, `Claim ${draft.decision.replace('_', ' ')}`, 'A reviewer updated your claim.'])
      await client.query('INSERT INTO trace.audit_events (actor_id,action,target_id,detail) VALUES ($1,$2,$3,$4)',
        [actorId, `claim.${draft.decision}`, claimId, draft.note || null])
      return claimId
    })
  }

  async recordHandoff(actorId, input) {
    requireUuid(actorId, 'actor ID')
    const draft = parsed(handoffRequest, input)
    requireUuid(draft.itemId, 'found report ID'); requireUuid(draft.claimId, 'claim ID')
    requireUuid(input.idempotencyKey, 'idempotency key')
    if (draft.note.length > 2000) fail('validation', 'Handoff note is too long.')
    return transaction(this.pool, async (client) => {
      const existing = await client.query('SELECT * FROM trace.handoffs WHERE recorded_by=$1 AND idempotency_key=$2', [actorId, input.idempotencyKey])
      if (existing.rowCount) {
        const handoff = existing.rows[0]
        const community = await client.query('SELECT community_id FROM trace.reports WHERE id=$1', [handoff.found_item_id])
        if (!community.rowCount) fail('not_found', 'Report not found.')
        await reviewer(client, actorId, community.rows[0].community_id)
        if (handoff.claim_id !== draft.claimId || handoff.found_item_id !== draft.itemId || handoff.note !== draft.note) {
          fail('conflict', 'The idempotency key was used for a different handoff.')
        }
        return handoff.id
      }
      let claim = await claimSnapshot(client, draft.claimId)
      await reviewer(client, actorId, claim.community_id)
      const reports = await lockReports(client, [claim.item_id, claim.related_lost_report_id])
      await client.query('SELECT id FROM trace.claims WHERE id=$1 FOR UPDATE', [draft.claimId])
      claim = await claimSnapshot(client, draft.claimId)
      if (claim.item_id !== draft.itemId || claim.status !== 'approved' || claim.item_status !== 'awaiting_handoff') {
        fail('conflict', 'An approved claim and available handoff are required.')
      }
      assertRelatedAvailable(reports, claim)
      const inserted = await client.query(`
        INSERT INTO trace.handoffs (claim_id,found_item_id,recorded_by,recipient_id,idempotency_key,note)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [draft.claimId, draft.itemId, actorId, claim.claimant_id, input.idempotencyKey, draft.note])
      await client.query("UPDATE trace.reports SET status='returned',updated_at=now() WHERE id = ANY($1::uuid[])", [[draft.itemId, claim.related_lost_report_id].filter(Boolean)])
      const closed = await client.query(`UPDATE trace.claims SET status='rejected', updated_at=now(),
        reviewer_note=CASE WHEN item_id=$1 THEN 'Item returned to another verified claimant' ELSE 'Linked lost report was returned' END
        WHERE id<>$2 AND status IN ('pending','under_review') AND
          (item_id=$1 OR (related_lost_report_id=$3 AND claimant_id=$4))
        RETURNING id,item_id,claimant_id`, [draft.itemId, draft.claimId, claim.related_lost_report_id, claim.claimant_id])
      const alternatives = [...new Set(closed.rows.map((row) => row.item_id).filter((id) => id !== draft.itemId))]
      if (alternatives.length) await client.query(`UPDATE trace.reports r SET status='unclaimed',updated_at=now()
        WHERE r.id=ANY($1::uuid[]) AND r.status='claim_pending' AND NOT EXISTS
          (SELECT 1 FROM trace.claims c WHERE c.item_id=r.id AND c.status IN ('pending','under_review','approved'))`, [alternatives])
      for (const reportId of [draft.itemId, claim.related_lost_report_id].filter(Boolean)) {
        await client.query('INSERT INTO trace.report_timeline (report_id,label,description,done) VALUES ($1,$2,$3,true)',
          [reportId, 'Returned', 'A verified handoff was recorded'])
      }
      await client.query('INSERT INTO trace.notifications (user_id,title,message) VALUES ($1,$2,$3)', [claim.claimant_id, 'Item returned', 'Your handoff was recorded.'])
      for (const other of closed.rows) await client.query('INSERT INTO trace.notifications (user_id,title,message) VALUES ($1,$2,$3)', [other.claimant_id, 'Claim closed', 'A related item was returned.'])
      await client.query('INSERT INTO trace.audit_events (actor_id,action,target_id,detail) VALUES ($1,$2,$3,$4)', [actorId, 'handoff.confirmed', inserted.rows[0].id, draft.note])
      return inserted.rows[0].id
    })
  }
}
