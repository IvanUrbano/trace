import { z } from 'zod'
import { notificationSchema, publicItemSchema, restrictedClaimSchema, restrictedItemSchema } from './dto.ts'

/** Success bodies for the future API. Errors use `apiErrorResponseSchema`. */

export const listPublicItemsResponse = z.object({
  items: z.array(publicItemSchema),
  nextCursor: z.string().nullish(),
})

export type ListPublicItemsResponse = z.infer<typeof listPublicItemsResponse>

export const createReportResponse = z.object({ itemId: z.string() })

export const myReportsResponse = z.object({ items: z.array(restrictedItemSchema) })

export const submitClaimResponse = z.object({ claimId: z.string() })

export const myClaimsResponse = z.object({ claims: z.array(restrictedClaimSchema) })

export const reviewClaimResponse = z.object({ claim: restrictedClaimSchema })

export const handoffResponse = z.object({
  itemId: z.string(),
  returnedAt: z.string(),
})

export const notificationsResponse = z.object({
  notifications: z.array(notificationSchema),
})

export const markNotificationsReadResponse = z.object({ updated: z.number().int().nonnegative() })

export const photoUploadResponse = z.object({
  objectKey: z.string(),
  uploadUrl: z.string(),
  expiresAt: z.string(),
})
