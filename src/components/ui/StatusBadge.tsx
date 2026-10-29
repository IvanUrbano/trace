import type { ClaimStatus, ItemStatus } from '../../lib/types'
import { cn } from '../../lib/utils'

const itemLabels: Record<ItemStatus, string> = {
  unclaimed: 'Unclaimed',
  claim_pending: 'Claim Pending',
  claim_under_review: 'Approved — Handoff',
  returned: 'Returned',
  active: 'Active',
}

const itemDot: Record<ItemStatus, string> = {
  unclaimed: 'bg-ink',
  claim_pending: 'bg-muted',
  claim_under_review: 'bg-ink/40',
  returned: 'bg-transparent border border-ink',
  active: 'bg-ink',
}

export function StatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[2px] border border-line bg-paper px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', itemDot[status])} />
      {itemLabels[status]}
    </span>
  )
}

const claimLabels: Record<ClaimStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Declined',
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span className="inline-flex items-center rounded-[2px] border border-line bg-mist px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]">
      {claimLabels[status]}
    </span>
  )
}
