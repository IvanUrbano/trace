import { z } from 'zod'

/**
 * Validated request bodies for the future API.
 * The demo mutation layer parses these too, so the browser and the backend
 * enforce the same rules at the authoritative boundary.
 */

const dateNotInFuture = z
  .string()
  .min(1, 'Enter the date.')
  .refine((value) => {
    const trimmed = value.trim()
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    const parsed = new Date(dateOnly ? `${trimmed}T00:00:00.000Z` : trimmed)
    if (Number.isNaN(parsed.getTime())) return false
    if (dateOnly && parsed.toISOString().slice(0, 10) !== trimmed) return false
    return parsed.getTime() <= Date.now()
  }, 'Enter a valid date that is not in the future.')

export const createReportRequest = z.object({
  type: z.enum(['lost', 'found']),
  title: z.string().min(3, 'Give the item a clear name (at least 3 characters).'),
  category: z.string().min(1, 'Choose a category.'),
  description: z.string().min(20, 'Describe the item in at least 20 characters.'),
  location: z.string().min(1, 'Choose an approximate location.'),
  date: dateNotInFuture,
  privateDetails: z.string().optional(),
  images: z.array(z.string()).max(4, 'Attach at most four photos.').default([]),
})

export type CreateReportRequest = z.infer<typeof createReportRequest>

export const submitClaimRequest = z.object({
  itemId: z.string().min(1, 'Select the found item you are claiming.'),
  statement: z
    .string().trim()
    .min(20, 'Explain why this item may belong to you (at least 20 characters).'),
  contactEmail: z.email('Enter a valid email address.'),
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        question: z.string().min(1),
        answer: z.string().trim().min(1, 'Answer required.'),
      }),
    )
    .min(1, 'Answer the ownership questions.'),
  /** The claimant's own lost report this claim is based on, when they link one. */
  relatedLostReportId: z.string().min(1).optional(),
})

export type SubmitClaimRequest = z.infer<typeof submitClaimRequest>

export const reviewClaimRequest = z.object({
  decision: z.enum(['under_review', 'approved', 'rejected']),
  note: z.string().trim().max(2000).optional(),
})

export type ReviewClaimRequest = z.infer<typeof reviewClaimRequest>

export const handoffRequest = z.object({
  itemId: z.string().min(1),
  claimId: z.string().min(1),
  note: z
    .string()
    .trim()
    .min(5, 'Record at least five characters describing the handoff.'),
})

export type HandoffRequest = z.infer<typeof handoffRequest>

export const publicItemQuery = z.object({
  type: z.enum(['lost', 'found']).optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
})

export type PublicItemQuery = z.infer<typeof publicItemQuery>

export const photoUploadRequest = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().positive().max(5_000_000, 'Photos must be 5 MB or smaller.'),
})

export type PhotoUploadRequest = z.infer<typeof photoUploadRequest>
