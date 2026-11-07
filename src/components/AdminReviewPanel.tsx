import { useState } from 'react'
import type { Claim } from '../lib/types'
import { relativeTime } from '../lib/utils'
import { useStore } from '../lib/store'
import { ClaimStatusBadge } from './ui/StatusBadge'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

export function AdminReviewPanel() {
  const { claims, items, updateClaimStatus, markReturned, user } = useStore()
  const [deciding, setDeciding] = useState<{ claim: Claim; action: 'approved' | 'rejected' } | null>(null)
  const [note, setNote] = useState('')
  const [handoff, setHandoff] = useState<Claim | null>(null)
  const [handoffNote, setHandoffNote] = useState('')

  const pending = claims.filter((c) => c.status === 'pending' || c.status === 'under_review')
  const decided = claims.filter((c) => c.status === 'approved' || c.status === 'rejected')
  const authorized = user?.role === 'admin'

  const closeDecision = () => {
    setDeciding(null)
    setNote('')
  }
  const closeHandoff = () => {
    setHandoff(null)
    setHandoffNote('')
  }

  const confirm = () => {
    if (!deciding) return
    if (!updateClaimStatus(deciding.claim.id, deciding.action, note.trim() || undefined)) return
    closeDecision()
  }

  const confirmHandoff = () => {
    if (!handoff || !markReturned(handoff.itemId, handoff.id, handoffNote)) return
    closeHandoff()
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="pending-claims">
        <h2 id="pending-claims" className="text-lg font-semibold tracking-tight">
          Pending claims
        </h2>
        <p className="mt-1 text-sm text-muted">
          Matching never approves ownership. Review each claim and decide manually.
        </p>
        {pending.length === 0 ? (
          <p className="mt-6 rounded-[3px] border border-dashed border-line bg-mist/40 px-6 py-10 text-center text-sm text-muted">
            The review queue is empty.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {pending.map((claim) => {
              const item = items.find((i) => i.id === claim.itemId)
              const linkedLost = items.find((i) => i.id === claim.relatedLostReportId && i.type === 'lost' && i.ownerId === claim.claimantId)
              const canReview = authorized && user?.id !== claim.claimantId
              return (
                <li key={claim.id} className="rounded-[4px] border border-line bg-paper p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold tracking-tight">{claim.itemTitle}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        Claimed by {claim.claimantName} · {relativeTime(claim.createdAt)}
                      </p>
                    </div>
                    <ClaimStatusBadge status={claim.status} />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed">{claim.statement}</p>
                  <dl className="mt-4 space-y-2 rounded-[3px] bg-mist/60 p-4 text-sm">
                    {claim.questions.map((q) => (
                      <div key={q.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                        <dt className="w-64 shrink-0 text-xs font-medium uppercase tracking-[0.1em] text-muted">
                          {q.question}
                        </dt>
                        <dd className="font-medium">{q.answer}</dd>
                      </div>
                    ))}
                  </dl>
                  {item?.privateDetails && (
                    <p className="mt-3 rounded-[3px] border border-line p-3 text-xs leading-relaxed text-muted">
                      <span className="font-semibold text-ink">Private reference details (finder-provided): </span>
                      {item.privateDetails}
                    </p>
                  )}
                  {linkedLost && <div className="mt-3 rounded-[3px] border border-line p-3 text-xs leading-relaxed text-muted">
                    <p><span className="font-semibold text-ink">Linked lost report: </span>{linkedLost.title} · {linkedLost.location}</p>
                    {linkedLost.privateDetails && <p className="mt-2"><span className="font-semibold text-ink">Claimant's identifying details: </span>{linkedLost.privateDetails}</p>}
                  </div>}
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      disabled={!canReview}
                      onClick={() => setDeciding({ claim, action: 'approved' })}
                    >
                      Approve Claim
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!canReview}
                      onClick={() => setDeciding({ claim, action: 'rejected' })}
                    >
                      Decline
                    </Button>
                  </div>
                  {!authorized && (
                    <p className="mt-3 text-xs text-muted">
                      Sign in as an administrator to take action on claims.
                    </p>
                  )}
                  {authorized && !canReview && <p className="mt-3 text-xs text-muted">A different administrator must review your claim.</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="decided-claims">
        <h2 id="decided-claims" className="text-lg font-semibold tracking-tight">
          Decided claims
        </h2>
        <ul className="mt-6 space-y-3">
          {decided.map((claim) => {
            const item = items.find((i) => i.id === claim.itemId)
            const canConfirm = claim.status === 'approved' && item?.status === 'awaiting_handoff'
            return (
              <li key={claim.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-line bg-paper px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{claim.itemTitle}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {claim.claimantName} · {relativeTime(claim.updatedAt)}
                    {claim.adminNote ? ` · Note: ${claim.adminNote}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ClaimStatusBadge status={claim.status} />
                  {canConfirm && (
                    <Button size="sm" variant="secondary" disabled={!authorized} onClick={() => setHandoff(claim)}>
                      Confirm Handoff
                    </Button>
                  )}
                  {item?.status === 'returned' && claim.status === 'approved' && (
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Returned</span>
                  )}
                </div>
              </li>
            )
          })}
          {decided.length === 0 && (
            <li className="rounded-[3px] border border-dashed border-line bg-mist/40 px-6 py-8 text-center text-sm text-muted">
              No decided claims yet.
            </li>
          )}
        </ul>
      </section>

      <Modal
        open={!!deciding}
        onClose={closeDecision}
        title={deciding?.action === 'approved' ? 'Approve claim' : 'Decline claim'}
      >
        <p className="text-sm leading-relaxed text-muted">
          {deciding?.action === 'approved'
            ? 'Approving confirms the answers appear consistent with ownership. The handoff must still be recorded separately.'
            : 'Declining closes this claim. The claimant will be notified with your note.'}
        </p>
        <label className="mt-5 block text-sm font-medium" htmlFor="admin-note">
          Note (optional)
        </label>
        <textarea
          id="admin-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Context for the audit trail…"
          className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm focus:border-ink"
        />
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={closeDecision}>
            Cancel
          </Button>
          <Button onClick={confirm}>Confirm</Button>
        </div>
      </Modal>
      <Modal open={!!handoff} onClose={closeHandoff} title="Confirm handoff">
        <p className="text-sm leading-relaxed text-muted">
          Confirm the item was handed to {handoff?.claimantName}. Record how and where the handoff happened.
        </p>
        <label className="mt-5 block text-sm font-medium" htmlFor="handoff-note">Handoff record</label>
        <textarea
          id="handoff-note"
          rows={3}
          value={handoffNote}
          onChange={(event) => setHandoffNote(event.target.value)}
          placeholder="Date, location, and who checked the handoff"
          className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm focus:border-ink"
        />
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={closeHandoff}>Cancel</Button>
          <Button onClick={confirmHandoff} disabled={handoffNote.trim().length < 5}>Record Handoff</Button>
        </div>
      </Modal>
    </div>
  )
}
