import type {
  CreateReportRequest,
  HandoffRequest,
  PublicItem,
  PublicItemQuery,
  ReviewClaimRequest,
  SubmitClaimRequest,
} from '../contract'
import type { OpResult } from '../contract'
import type { MatchResult } from '../matching'
import type { Claim, Item, Notification, User } from '../types'

/**
 * The application service contract. Pages consume these operations through
 * the store facade; the demo store implements them synchronously on top of
 * `domain.ts`, and the future API implementation will back them with HTTP.
 *
 * Rules that live here must never be duplicated in page components:
 * identity comes from `actor` (never from request fields), restricted reads
 * are scoped to the actor, and every mutation validates before writing.
 */
export interface TraceService {
  listPublicItems(query?: PublicItemQuery): Promise<OpResult<PublicItem[]>>
  getPublicItem(itemId: string): Promise<OpResult<PublicItem>>
  createReport(actor: User | null, input: CreateReportRequest): Promise<OpResult<string>>
  listMyReports(actor: User | null): Promise<OpResult<Item[]>>
  listMatches(actor: User | null, lostItemId: string): Promise<OpResult<MatchResult[]>>
  submitClaim(actor: User | null, input: SubmitClaimRequest): Promise<OpResult<string>>
  listMyClaims(actor: User | null): Promise<OpResult<Claim[]>>
  reviewClaim(
    actor: User | null,
    claimId: string,
    input: ReviewClaimRequest,
  ): Promise<OpResult<string>>
  recordHandoff(actor: User | null, input: HandoffRequest): Promise<OpResult<string>>
  listNotifications(actor: User | null): Promise<OpResult<Notification[]>>
  markNotificationsRead(actor: User | null): Promise<OpResult<number>>
  requestPhotoUpload(
    actor: User | null,
    input: { fileName: string; contentType: string; sizeBytes: number },
  ): Promise<OpResult<{ objectKey: string; uploadUrl: string; expiresAt: string }>>
}
