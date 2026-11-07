import { z } from 'zod'
import {
  createReportRequest,
  fail,
  handoffRequest,
  migrateItemStatus,
  ok,
  publicItemSchema,
  restrictedClaimSchema,
  restrictedItemSchema,
  notificationSchema,
  auditEntrySchema,
  reviewClaimRequest,
  submitClaimRequest,
  type ApiError,
  type OpResult,
  type PublicItem,
  type RestrictedClaim,
  type RestrictedItem,
} from '../contract/index.ts'
import { rankFoundMatches, type MatchResult } from '../matching.ts'
import type { AuditEntry, Claim, Item, Notification, User } from '../types'
import { uid } from '../utils.ts'

/**
 * Authoritative mutation layer for the demo application and the future
 * backend. Every rule that guards a write lives here once: the React store
 * and the API both call these functions, so pages never re-implement them.
 *
 * All operations are pure: they receive the current data plus the acting
 * user and return the next data together with a typed result. Identity is
 * always the `actor` argument — request bodies never carry owner, claimant,
 * or reviewer identity.
 */

export interface TraceData {
  items: Item[]
  claims: Claim[]
  notifications: Notification[]
  audit: AuditEntry[]
}

export interface OpOutcome<T> {
  data: TraceData
  result: OpResult<T>
}

function issueOf(error: z.ZodError): ApiError {
  const issue = error.issues[0]
  return {
    code: 'validation',
    message: issue.message,
    field: issue.path.join('.'),
    retryable: false,
  }
}

function rejected<T>(data: TraceData, result: OpResult<T>): OpOutcome<T> {
  return { data, result }
}

function notAvailable<T>(): OpResult<T> {
  return fail<T>('conflict', 'This item is not available for a new claim')
}

function claimDenied<T>(): OpResult<T> {
  return fail<T>('conflict', 'This claim cannot be updated')
}

function handoffDenied<T>(): OpResult<T> {
  return fail<T>('conflict', 'An approved claim and handoff note are required')
}

/** Explicit field pick — the public shape can never grow private fields by accident. */
export function toPublicItem(item: Item): PublicItem {
  return publicItemSchema.parse({
    id: item.id,
    type: item.type,
    title: item.title,
    category: item.category,
    description: item.description,
    location: item.location,
    date: item.date,
    status: item.status,
    images: item.images,
    createdAt: item.createdAt,
    timeline: item.timeline,
  })
}

/**
 * Migrates persisted browser records to the current model (v1 → v2).
 * Older records used `claim_under_review`; that status becomes
 * `awaiting_handoff`. Items whose status cannot be migrated are dropped,
 * and structurally invalid payloads return null so callers fall back to
 * seed data instead of trusting corrupt state.
 */
export function migrateTraceData(raw: unknown): TraceData | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (
    !Array.isArray(record.items) ||
    !Array.isArray(record.claims) ||
    !Array.isArray(record.notifications) ||
    !Array.isArray(record.audit)
  ) {
    return null
  }
  const items: Item[] = []
  for (const entry of record.items) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Item
    const status = migrateItemStatus(item.status)
    if (!status) continue
    const parsed = restrictedItemSchema.safeParse({ ...item, status })
    if (!parsed.success) return null
    items.push(parsed.data)
  }
  const claims = z.array(restrictedClaimSchema).safeParse(record.claims)
  const notifications = z.array(notificationSchema).safeParse(record.notifications)
  const audit = z.array(auditEntrySchema).safeParse(record.audit)
  if (!claims.success || !notifications.success || !audit.success) return null
  return {
    items,
    claims: claims.data,
    notifications: notifications.data,
    audit: audit.data,
  }
}

export function createReport(
  data: TraceData,
  actor: User | null,
  input: unknown,
): OpOutcome<string> {
  if (!actor) return rejected(data, fail('unauthorized', 'Sign in to submit a report'))
  const parsed = createReportRequest.safeParse(input)
  if (!parsed.success) return rejected(data, { ok: false, error: issueOf(parsed.error) })

  const draft = parsed.data
  const now = new Date().toISOString()
  const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
    ? new Date(`${draft.date}T00:00:00.000Z`).toISOString()
    : new Date(draft.date).toISOString()
  const item: Item = {
    id: uid('item'),
    type: draft.type,
    title: draft.title,
    category: draft.category,
    description: draft.description,
    location: draft.location,
    date: dateIso,
    status: draft.type === 'lost' ? 'active' : 'unclaimed',
    images: draft.images,
    ownerId: actor.id,
    ownerName: actor.name,
    privateDetails: draft.privateDetails || undefined,
    createdAt: now,
    timeline: [
      {
        id: uid('tl'),
        label: draft.type === 'lost' ? 'Reported lost' : 'Reported found',
        description: 'Report submitted',
        date: now,
        done: true,
      },
      {
        id: uid('tl'),
        label: draft.type === 'lost' ? 'Matching in progress' : 'Listed publicly',
        description: draft.type === 'lost' ? 'Possible matches will surface here' : 'Visible on Discover',
        date: now,
        done: draft.type === 'found',
      },
      {
        id: uid('tl'),
        label: draft.type === 'lost' ? 'Match found' : 'Awaiting claim',
        description: draft.type === 'lost' ? 'Awaiting verification' : 'No claims yet',
        date: now,
        done: false,
      },
      {
        id: uid('tl'),
        label: draft.type === 'lost' ? 'Returned' : 'Verified handoff',
        description: 'Pending verification',
        date: now,
        done: false,
      },
    ],
  }
  const audit: AuditEntry = {
    id: uid('audit'),
    actor: actor.name,
    action: 'item.reported',
    target: item.title,
    timestamp: now,
    detail: `${item.type} report created`,
  }
  return {
    data: { ...data, items: [item, ...data.items], audit: [audit, ...data.audit] },
    result: ok(item.id),
  }
}

export function submitClaim(
  data: TraceData,
  actor: User | null,
  input: unknown,
): OpOutcome<string> {
  if (!actor) return rejected(data, fail('unauthorized', 'Sign in to submit a claim'))
  const parsed = submitClaimRequest.safeParse(input)
  if (!parsed.success) return rejected(data, { ok: false, error: issueOf(parsed.error) })

  const draft = parsed.data
  const item = data.items.find((candidate) => candidate.id === draft.itemId)
  if (!item) return rejected(data, notAvailable())
  if (item.type !== 'found' || item.status === 'returned' || item.ownerId === actor.id) {
    return rejected(data, notAvailable())
  }
  if (
    data.claims.some(
      (claim) => claim.itemId === item.id && (claim.claimantId === actor.id || claim.status === 'approved'),
    )
  ) {
    return rejected(data, notAvailable())
  }
  if (draft.relatedLostReportId) {
    const related = data.items.find((candidate) => candidate.id === draft.relatedLostReportId)
    if (!related || related.type !== 'lost' || related.ownerId !== actor.id || related.status !== 'active') {
      return rejected(data, fail('conflict', 'Link one of your own active lost reports to this claim'))
    }
  }

  const now = new Date().toISOString()
  const claim: Claim = {
    id: uid('claim'),
    itemId: item.id,
    itemTitle: item.title,
    claimantId: actor.id,
    claimantName: actor.name,
    statement: draft.statement,
    questions: draft.questions,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    contactEmail: draft.contactEmail,
    relatedLostReportId: draft.relatedLostReportId,
  }
  const items = data.items.map((candidate) =>
    candidate.id === item.id
      ? {
          ...candidate,
          status: 'claim_pending' as const,
          timeline: candidate.timeline.map((entry, index) =>
            index === 2
              ? { ...entry, label: 'Claim submitted', description: 'Awaiting review', done: true }
              : entry,
          ),
        }
      : candidate,
  )
  const notification: Notification = {
    id: uid('n'),
    userId: actor.id,
    title: 'Claim submitted',
    message: `Your claim for “${item.title}” has been received.`,
    read: false,
    createdAt: now,
  }
  const audit: AuditEntry = {
    id: uid('audit'),
    actor: actor.name,
    action: 'claim.submitted',
    target: item.title,
    timestamp: now,
    detail: 'Ownership questions answered',
  }
  return {
    data: {
      ...data,
      items,
      claims: [claim, ...data.claims],
      notifications: [notification, ...data.notifications],
      audit: [audit, ...data.audit],
    },
    result: ok(claim.id),
  }
}

export function reviewClaim(
  data: TraceData,
  actor: User | null,
  claimId: string,
  input: unknown,
): OpOutcome<string> {
  if (!actor) return rejected(data, fail('unauthorized', 'This claim cannot be updated'))
  const parsed = reviewClaimRequest.safeParse(input)
  if (!parsed.success) return rejected(data, { ok: false, error: issueOf(parsed.error) })
  if (actor.role !== 'admin') return rejected(data, fail('forbidden', 'This claim cannot be updated'))

  const decision = parsed.data.decision
  const note = parsed.data.note || undefined
  const claim = data.claims.find((candidate) => candidate.id === claimId)
  if (!claim) return rejected(data, claimDenied())
  if (claim.claimantId === actor.id) {
    return rejected(data, fail('forbidden', 'A different administrator must review your claim'))
  }
  const item = data.items.find((candidate) => candidate.id === claim.itemId)
  if (!item) return rejected(data, claimDenied())
  if (item.type !== 'found' || item.status === 'returned') return rejected(data, claimDenied())
  if (claim.status !== 'pending' && claim.status !== 'under_review') return rejected(data, claimDenied())
  if (claim.status === decision) return rejected(data, claimDenied())
  if (decision === 'approved' && claim.relatedLostReportId) {
    const related = data.items.find((candidate) => candidate.id === claim.relatedLostReportId)
    if (!related || related.type !== 'lost' || related.ownerId !== claim.claimantId || related.status !== 'active' ||
      data.claims.some((other) => other.id !== claim.id && other.relatedLostReportId === related.id && other.status === 'approved')) {
      return rejected(data, fail('conflict', 'The linked lost report is no longer available for this approval'))
    }
  }
  if (
    decision === 'approved' &&
    data.claims.some(
      (other) => other.itemId === item.id && other.id !== claimId && other.status === 'approved',
    )
  ) {
    return rejected(data, claimDenied())
  }

  const now = new Date().toISOString()
  const claims = data.claims.map((candidate) =>
    candidate.id === claimId
      ? { ...candidate, status: decision, updatedAt: now, adminNote: note ?? candidate.adminNote }
      : candidate,
  )
  const notification: Notification = {
    id: uid('n'),
    userId: claim.claimantId,
    title: decision === 'approved' ? 'Claim approved' : decision === 'rejected' ? 'Claim declined' : 'Claim in review',
    message:
      decision === 'approved'
        ? `Your claim for “${claim.itemTitle}” was approved. Arrange a verified handoff.`
        : decision === 'rejected'
          ? `Your claim for “${claim.itemTitle}” was not approved.`
          : `Your claim for “${claim.itemTitle}” is under review.`,
    read: false,
    createdAt: now,
  }
  const audit: AuditEntry = {
    id: uid('audit'),
    actor: actor.name,
    action: `claim.${decision}`,
    target: claim.itemTitle,
    timestamp: now,
    detail: note,
  }

  let items = data.items
  if (decision === 'approved') {
    items = items.map((candidate) =>
      candidate.id === claim.itemId
        ? {
            ...candidate,
            status: 'awaiting_handoff' as const,
            timeline: candidate.timeline.map((entry, index) =>
              index === 2
                ? { ...entry, label: 'Claim approved', description: 'Arrange verified handoff', done: true }
                : entry,
            ),
          }
        : candidate,
    )
  }
  if (decision === 'rejected') {
    const otherOpenClaims = data.claims.some(
      (other) =>
        other.itemId === claim.itemId &&
        other.id !== claim.id &&
        (other.status === 'pending' || other.status === 'under_review' || other.status === 'approved'),
    )
    if (!otherOpenClaims) {
      items = items.map((candidate) =>
        candidate.id === claim.itemId &&
        (candidate.status === 'claim_pending' || candidate.status === 'awaiting_handoff')
          ? {
              ...candidate,
              status: 'unclaimed' as const,
              timeline: candidate.timeline.map((entry, index) =>
                index === 2
                  ? { ...entry, label: 'Awaiting claim', description: 'No open claims', done: false }
                  : entry,
              ),
            }
          : candidate,
      )
    }
  }

  return {
    data: {
      ...data,
      items,
      claims,
      notifications: [notification, ...data.notifications],
      audit: [audit, ...data.audit],
    },
    result: ok(claimId),
  }
}

export function recordHandoff(
  data: TraceData,
  actor: User | null,
  input: unknown,
): OpOutcome<string> {
  if (!actor) return rejected(data, fail('unauthorized', 'An approved claim and handoff note are required'))
  if (actor.role !== 'admin') return rejected(data, fail('forbidden', 'An approved claim and handoff note are required'))
  const parsed = handoffRequest.safeParse(input)
  if (!parsed.success) return rejected(data, { ok: false, error: issueOf(parsed.error) })

  const { itemId, claimId } = parsed.data
  const handoffNote = parsed.data.note.trim()
  const item = data.items.find((candidate) => candidate.id === itemId)
  const claim = data.claims.find((candidate) => candidate.id === claimId && candidate.itemId === itemId)
  if (!item || !claim) return rejected(data, handoffDenied())
  if (item.type !== 'found' || item.status !== 'awaiting_handoff' || claim.status !== 'approved') {
    return rejected(data, handoffDenied())
  }
  if (claim.relatedLostReportId) {
    const related = data.items.find((candidate) => candidate.id === claim.relatedLostReportId)
    if (!related || related.type !== 'lost' || related.ownerId !== claim.claimantId || related.status !== 'active' ||
      data.claims.some((other) => other.id !== claim.id && other.relatedLostReportId === related.id && other.status === 'approved')) {
      return rejected(data, fail('conflict', 'The linked lost report is no longer available for this handoff'))
    }
  }

  const now = new Date().toISOString()
  const otherClaims = data.claims.filter(
    (candidate) =>
      (candidate.itemId === itemId ||
        (!!claim.relatedLostReportId && candidate.relatedLostReportId === claim.relatedLostReportId && candidate.claimantId === claim.claimantId)) &&
      candidate.id !== claimId &&
      (candidate.status === 'pending' || candidate.status === 'under_review'),
  )
  const items = data.items.map((candidate) => {
    if (candidate.id === itemId) {
      return {
        ...candidate,
        status: 'returned' as const,
        timeline: candidate.timeline.map((entry, index) =>
          index === candidate.timeline.length - 1
            ? { ...entry, done: true, date: now, description: 'Returned to verified claimant' }
            : entry,
        ),
      }
    }
    // Close the claimant's linked lost report so both sides of the pair end together.
    if (
      claim.relatedLostReportId &&
      candidate.id === claim.relatedLostReportId &&
      candidate.ownerId === claim.claimantId &&
      candidate.type === 'lost'
    ) {
      return {
        ...candidate,
        status: 'returned' as const,
        timeline: candidate.timeline.map((entry, index) =>
          index === candidate.timeline.length - 1
            ? { ...entry, done: true, date: now, description: 'Item recovered' }
            : entry,
        ),
      }
    }
    if (candidate.type === 'found' && candidate.status === 'claim_pending' &&
      otherClaims.some((other) => other.itemId === candidate.id) &&
      !data.claims.some((other) => other.itemId === candidate.id && other.id !== claimId &&
        !otherClaims.some((closed) => closed.id === other.id) &&
        (other.status === 'pending' || other.status === 'under_review' || other.status === 'approved'))) {
      return {
        ...candidate,
        status: 'unclaimed' as const,
        timeline: candidate.timeline.map((entry, index) => index === 2
          ? { ...entry, label: 'Awaiting claim', description: 'No open claims', done: false }
          : entry),
      }
    }
    return candidate
  })
  const claims = data.claims.map((candidate) =>
    otherClaims.some((other) => other.id === candidate.id)
      ? {
          ...candidate,
          status: 'rejected' as const,
          updatedAt: now,
          adminNote: candidate.itemId === itemId ? 'Item returned to another verified claimant' : 'Linked lost report was returned',
        }
      : candidate,
  )
  const notifications: Notification[] = [
    {
      id: uid('n'),
      userId: claim.claimantId,
      title: 'Item returned',
      message: `The handoff for “${item.title}” was recorded.`,
      read: false,
      createdAt: now,
    },
    ...otherClaims.map((other) => ({
      id: uid('n'),
      userId: other.claimantId,
      title: 'Claim closed',
      message: other.itemId === itemId
        ? `“${item.title}” was returned to another verified claimant.`
        : `Your linked lost report was returned; your claim for “${other.itemTitle}” was closed.`,
      read: false,
      createdAt: now,
    })),
  ]
  const audit: AuditEntry = {
    id: uid('audit'),
    actor: actor.name,
    action: 'handoff.confirmed',
    target: item.title,
    timestamp: now,
    detail: `Claimant: ${claim.claimantName}. ${handoffNote}`,
  }
  return {
    data: {
      ...data,
      items,
      claims,
      notifications: [...notifications, ...data.notifications],
      audit: [audit, ...data.audit],
    },
    result: ok(itemId),
  }
}

export function markAllNotificationsRead(
  data: TraceData,
  actor: User | null,
): OpOutcome<number> {
  if (!actor) return rejected(data, fail('unauthorized', 'Sign in to view notifications'))
  let updated = 0
  const notifications = data.notifications.map((notification) => {
    if (notification.userId === actor.id && !notification.read) {
      updated += 1
      return { ...notification, read: true }
    }
    return notification
  })
  return { data: { ...data, notifications }, result: ok(updated) }
}

/* ---- Restricted reads (scope every response to the actor) ---- */

export function getRestrictedItem(
  data: TraceData,
  actor: User | null,
  itemId: string,
): OpResult<RestrictedItem> {
  if (!actor) return fail('unauthorized', 'Sign in to view this report')
  const item = data.items.find((candidate) => candidate.id === itemId)
  // Missing and not-yours look identical so ids cannot be probed.
  if (!item || (item.ownerId !== actor.id && actor.role !== 'admin')) {
    return fail('not_found', 'Report not found')
  }
  return ok(restrictedItemSchema.parse(item))
}

export function listMyReports(data: TraceData, actor: User | null): OpResult<RestrictedItem[]> {
  if (!actor) return fail('unauthorized', 'Sign in to view your reports')
  return ok(
    data.items
      .filter((item) => item.ownerId === actor.id)
      .map((item) => restrictedItemSchema.parse(item)),
  )
}

export function listMyClaims(data: TraceData, actor: User | null): OpResult<RestrictedClaim[]> {
  if (!actor) return fail('unauthorized', 'Sign in to view your claims')
  return ok(
    data.claims
      .filter((claim) => claim.claimantId === actor.id)
      .map((claim) => restrictedClaimSchema.parse(claim)),
  )
}

export function listMyNotifications(
  data: TraceData,
  actor: User | null,
): OpResult<Notification[]> {
  if (!actor) return fail('unauthorized', 'Sign in to view notifications')
  return ok(data.notifications.filter((notification) => notification.userId === actor.id))
}

export function listPublicItems(data: TraceData): PublicItem[] {
  return data.items
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicItem)
}

export function listMatches(
  data: TraceData,
  actor: User | null,
  lostItemId: string,
): OpResult<MatchResult[]> {
  if (!actor) return fail('unauthorized', 'Sign in to view possible matches')
  const lost = data.items.find((candidate) => candidate.id === lostItemId)
  if (!lost || lost.type !== 'lost' || lost.ownerId !== actor.id) {
    return fail('not_found', 'Report not found')
  }
  return ok(rankFoundMatches(lost, data.items))
}
