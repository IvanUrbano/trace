import { ZodError } from 'zod'
import { API_ERROR_HTTP_STATUS, apiError } from '../../src/lib/contract/errors.ts'
import {
  createReportRequest,
  handoffRequest,
  photoUploadRequest,
  publicItemQuery,
  reviewClaimRequest,
  submitClaimRequest,
} from '../../src/lib/contract/requests.ts'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { RepositoryError } from '../postgres/repository.mjs'

const DEFAULT_MAX_BODY_BYTES = 256 * 1024
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' }

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const iso = (value) => (value instanceof Date ? value.toISOString() : String(value ?? ''))
const optional = (key, value) => (value ? { [key]: value } : {})

function toPublicItem(row, baseUrl) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category,
    description: row.description,
    location: row.location,
    date: row.report_date ?? row.date ?? '',
    status: row.status,
    images: Array.isArray(row.images) ? row.images.map((key) => `${baseUrl}${key}`) : [],
    createdAt: iso(row.created_at),
    timeline: Array.isArray(row.timeline) ? row.timeline : [],
  }
}

function toRestrictedItem(row, actor, baseUrl) {
  return {
    ...toPublicItem(row, baseUrl),
    ownerId: row.owner_id ?? actor.id,
    ownerName: row.owner_name ?? actor.name ?? '',
    ...optional('privateDetails', row.reference_details ?? row.private_details),
  }
}

function toClaim(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.item_title ?? '',
    claimantId: row.claimant_id,
    claimantName: row.claimant_name ?? '',
    statement: row.statement,
    questions: Array.isArray(row.questions)
      ? row.questions.map((answer) => ({ id: answer.id, question: answer.question, answer: answer.answer }))
      : [],
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    ...optional('adminNote', row.reviewer_note),
    contactEmail: row.contact_email ?? '',
    ...optional('relatedLostReportId', row.related_lost_report_id),
  }
}

function toNotification(row, actorId) {
  return {
    id: row.id,
    userId: actorId,
    title: row.title,
    message: row.message,
    read: Boolean(row.read_at),
    createdAt: iso(row.created_at),
  }
}

function json(status, body, extraHeaders = {}) {
  return { status, headers: { ...JSON_HEADERS, ...extraHeaders }, body: JSON.stringify(body) }
}

function parseBody(raw) {
  if (!raw) throw new HttpError(422, 'validation', 'A JSON request body is required.')
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(422, 'validation', 'The request body is not valid JSON.')
  }
}

function parseWith(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new HttpError(422, 'validation', issue?.message || 'The request is invalid.')
  }
  return result.data
}

function toErrorResponse(error) {
  if (error instanceof HttpError) {
    return json(error.status, { error: apiError(error.code, error.message) })
  }
  if (error instanceof RepositoryError) {
    const status = API_ERROR_HTTP_STATUS[error.code] ?? 503
    return json(status, { error: apiError(error.code, error.message) })
  }
  if (error instanceof ZodError) {
    return json(422, { error: apiError('validation', error.issues[0]?.message || 'The request is invalid.') })
  }
  return json(500, { error: apiError('service_unavailable', 'Unexpected server error.') })
}

export function createApp({
  repository,
  verifyToken,
  communityName = 'Mandaluyong',
  allowedOrigins = [],
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  s3,
  s3Bucket,
  s3PublicBaseUrl,
}) {
  if (!repository) throw new Error('createApp requires a repository')
  if (typeof verifyToken !== 'function') throw new Error('createApp requires a token verifier')
  if (!s3) throw new Error('createApp requires an S3 client')
  if (!s3Bucket) throw new Error('createApp requires an S3 bucket name')
  if (!s3PublicBaseUrl) throw new Error('createApp requires an S3 public base URL')

  let communityIdPromise = null
  const communityId = () => {
    communityIdPromise ??= repository.ensureCommunity(communityName).catch((error) => {
      communityIdPromise = null
      throw error
    })
    return communityIdPromise
  }

  async function authenticate(headers) {
    const header = headers['authorization']
    if (typeof header !== 'string' || !/^Bearer\s+/i.test(header)) {
      throw new HttpError(401, 'unauthorized', 'Sign in is required.')
    }
    let identity
    try {
      identity = await verifyToken(header.replace(/^Bearer\s+/i, '').trim())
    } catch {
      throw new HttpError(401, 'unauthorized', 'Your session is invalid or expired.')
    }
    const id = await repository.ensureUser({
      issuer: identity.issuer,
      subject: identity.subject,
      displayName: identity.name || identity.username || identity.email,
      communityId: await communityId(),
      isAdmin: identity.groups.includes('admin'),
    })
    return { id, name: identity.name || identity.username || identity.email || '', identity }
  }

  const routes = [
    { method: 'GET', pattern: /^\/health$/, handler: async () => json(200, { ok: true }) },
    {
      method: 'GET',
      pattern: /^\/api\/items$/,
      handler: async ({ query }) => {
        const dateOnly = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined)
        const parsed = parseWith(publicItemQuery, {
          type: query.type,
          category: query.category,
          location: query.location,
          from: dateOnly(query.from),
          to: dateOnly(query.to),
          q: typeof query.q === 'string' ? query.q.slice(0, 120) : undefined,
          cursor: query.cursor,
          limit: query.limit === undefined ? 20 : Number(query.limit),
        })
        const items = await repository.listPublicReports(await communityId(), parsed)
        return json(200, { items: items.map((row) => toPublicItem(row, s3PublicBaseUrl)), nextCursor: null })
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/items\/([^/]+)$/,
      handler: async ({ params }) => json(200, toPublicItem(await repository.getPublicReport(await communityId(), params[0]), s3PublicBaseUrl)),
    },
    {
      method: 'POST',
      pattern: /^\/api\/photos\/presign$/,
      auth: true,
      handler: async ({ actor, body }) => {
        const input = parseWith(photoUploadRequest, parseBody(body))
        const key = `photos/${actor.id}/${crypto.randomUUID()}/${input.fileName}`
        const command = new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          ContentType: input.contentType,
          ContentLength: input.sizeBytes,
        })
        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 })
        return json(200, { objectKey: key, uploadUrl, expiresAt: new Date(Date.now() + 900 * 1000).toISOString() })
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/reports$/,
      auth: true,
      handler: async ({ actor, body }) => {
        const input = parseWith(createReportRequest, parseBody(body))
        const itemId = await repository.createReport(actor.id, await communityId(), input)
        return json(201, { itemId })
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/me\/reports$/,
      auth: true,
      handler: async ({ actor }) => {
        const items = await repository.listMyReports(actor.id)
        return json(200, { items: items.map((row) => toRestrictedItem(row, actor, s3PublicBaseUrl)) })
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/me\/claims$/,
      auth: true,
      handler: async ({ actor }) => json(200, { claims: (await repository.listMyClaims(actor.id)).map(toClaim) }),
    },
    {
      method: 'GET',
      pattern: /^\/api\/me\/matches$/,
      auth: true,
      handler: async ({ actor, query }) => {
        if (!query.lostReportId) throw new HttpError(422, 'validation', 'A lost report ID is required.')
        return json(200, { matches: await repository.listMatches(actor.id, query.lostReportId) })
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/me\/notifications$/,
      auth: true,
      handler: async ({ actor }) => {
        const rows = await repository.listNotifications(actor.id)
        return json(200, { notifications: rows.map((row) => toNotification(row, actor.id)) })
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/me\/notifications\/read$/,
      auth: true,
      handler: async ({ actor }) => json(200, { updated: await repository.markNotificationsRead(actor.id) }),
    },
    {
      method: 'POST',
      pattern: /^\/api\/claims$/,
      auth: true,
      handler: async ({ actor, body }) => {
        const input = parseWith(submitClaimRequest, parseBody(body))
        return json(201, { claimId: await repository.submitClaim(actor.id, input) })
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/admin\/review-queue$/,
      auth: true,
      handler: async ({ actor, query }) => {
        const limit = query.limit === undefined ? 50 : Number(query.limit)
        const rows = await repository.listReviewQueue(actor.id, await communityId(), limit)
        return json(200, { claims: rows.map(toClaim) })
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/admin\/claims\/([^/]+)\/evidence$/,
      auth: true,
      handler: async ({ actor, params }) => {
        const evidence = await repository.getReviewEvidence(actor.id, params[0])
        return json(200, {
          claim: toClaim(evidence.claim),
          references: evidence.references.map((row) => ({ reportId: row.report_id, details: row.reference_details })),
          answers: evidence.answers.map((row) => ({ id: row.question_key, question: row.question, answer: row.answer })),
        })
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/admin\/claims\/([^/]+)\/review$/,
      auth: true,
      handler: async ({ actor, params, body }) => {
        const input = parseWith(reviewClaimRequest, parseBody(body))
        const claimId = await repository.reviewClaim(actor.id, params[0], input)
        const evidence = await repository.getReviewEvidence(actor.id, claimId)
        return json(200, { claim: toClaim(evidence.claim) })
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/admin\/handoffs$/,
      auth: true,
      handler: async ({ actor, headers, body }) => {
        const payload = parseBody(body)
        const input = parseWith(handoffRequest, payload)
        const idempotencyKey = headers['idempotency-key'] || payload.idempotencyKey
        if (typeof idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey.trim())) {
          throw new HttpError(422, 'validation', 'A UUID idempotency key is required.')
        }
        await repository.recordHandoff(actor.id, { ...input, idempotencyKey: idempotencyKey.trim() })
        return json(201, { itemId: input.itemId, returnedAt: new Date().toISOString() })
      },
    },
  ]

  return async function handle(request) {
    const origin = request.headers['origin']
    const cors = typeof origin === 'string' && allowedOrigins.includes(origin)
      ? {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'authorization,content-type,idempotency-key',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-max-age': '600',
        vary: 'origin',
      }
      : {}

    if (request.method === 'OPTIONS') return { status: 204, headers: { ...cors }, body: '' }

    try {
      if (request.body && Buffer.byteLength(request.body, 'utf8') > maxBodyBytes) {
        throw new HttpError(413, 'validation', 'The request body is too large.')
      }
      for (const route of routes) {
        if (route.method !== request.method) continue
        const match = route.pattern.exec(request.path)
        if (!match) continue
        const actor = route.auth ? await authenticate(request.headers) : null
        const response = await route.handler({
          params: match.slice(1).map((value) => decodeURIComponent(value)),
          query: request.query,
          headers: request.headers,
          body: request.body,
          actor,
        })
        return { ...response, headers: { ...response.headers, ...cors } }
      }
      return { ...json(404, { error: apiError('not_found', 'Route not found.') }), headers: { ...JSON_HEADERS, ...cors } }
    } catch (error) {
      const response = toErrorResponse(error)
      return { ...response, headers: { ...response.headers, ...cors } }
    }
  }
}
