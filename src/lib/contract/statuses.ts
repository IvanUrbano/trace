/**
 * Canonical status names for storage and the future API.
 * Rename `claim_under_review` → `awaiting_handoff` happened here first;
 * older browser records are migrated through `migrateItemStatus`.
 */

export const ITEM_STATUSES = [
  'unclaimed',
  'claim_pending',
  'awaiting_handoff',
  'returned',
  'active',
] as const

export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const CLAIM_STATUSES = ['pending', 'under_review', 'approved', 'rejected'] as const

export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

/** Statuses written by earlier builds of this repository. */
export const LEGACY_ITEM_STATUS_MAP: Record<string, ItemStatus> = {
  claim_under_review: 'awaiting_handoff',
}

/** Returns the current status for a stored value, or null when it cannot be migrated. */
export function migrateItemStatus(value: unknown): ItemStatus | null {
  if (typeof value !== 'string') return null
  if ((ITEM_STATUSES as readonly string[]).includes(value)) return value as ItemStatus
  return LEGACY_ITEM_STATUS_MAP[value] ?? null
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === 'string' && (ITEM_STATUSES as readonly string[]).includes(value)
}

export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === 'string' && (CLAIM_STATUSES as readonly string[]).includes(value)
}
