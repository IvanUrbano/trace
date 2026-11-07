import { z } from 'zod'
import { CLAIM_STATUSES, ITEM_STATUSES } from './statuses.ts'

/**
 * Response shapes for the future API.
 *
 * Two rules:
 * - `publicItemSchema` is the ONLY shape allowed on unauthenticated routes.
 *   It has no owner, private-detail, claimant, or reviewer fields by construction.
 * - Restricted shapes (owner/admin/claimant views) are separate schemas, never
 *   supersets the UI "hides". A field that must not reach a browser is absent
 *   from the public schema entirely.
 */

export const listingTypeSchema = z.enum(['lost', 'found'])

export const timelineEventSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  date: z.string(),
  done: z.boolean(),
})

export const publicItemSchema = z.object({
  id: z.string(),
  type: listingTypeSchema,
  title: z.string(),
  category: z.string(),
  description: z.string(),
  location: z.string(),
  date: z.string(),
  status: z.enum(ITEM_STATUSES),
  images: z.array(z.string()),
  createdAt: z.string(),
  timeline: z.array(timelineEventSchema),
})

export type PublicItem = z.infer<typeof publicItemSchema>

/** Full item view — only for the report owner and administrators. */
export const restrictedItemSchema = publicItemSchema.extend({
  ownerId: z.string(),
  ownerName: z.string(),
  privateDetails: z.string().optional(),
})

export type RestrictedItem = z.infer<typeof restrictedItemSchema>

export const ownershipAnswerSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
})

/** Claim view — only for the claimant and reviewers. Never public. */
export const restrictedClaimSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  itemTitle: z.string(),
  claimantId: z.string(),
  claimantName: z.string(),
  statement: z.string(),
  questions: z.array(ownershipAnswerSchema),
  status: z.enum(CLAIM_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  adminNote: z.string().optional(),
  contactEmail: z.string(),
  relatedLostReportId: z.string().optional(),
})

export type RestrictedClaim = z.infer<typeof restrictedClaimSchema>

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
})

export type NotificationDto = z.infer<typeof notificationSchema>

/** Audit history — administrators only. */
export const auditEntrySchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
  timestamp: z.string(),
  detail: z.string().optional(),
})

export type AuditEntryDto = z.infer<typeof auditEntrySchema>

/** Fields that must never appear on any public response. */
export const PRIVATE_PUBLIC_ITEM_KEYS = [
  'ownerId',
  'ownerName',
  'privateDetails',
  'contactEmail',
  'claimantId',
  'claimantName',
  'adminNote',
] as const

export function publicItemFieldNames(): string[] {
  return Object.keys(publicItemSchema.shape)
}
