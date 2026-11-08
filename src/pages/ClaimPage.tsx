import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ClaimForm } from '../components/ClaimForm'
import { ClaimStatusBadge } from '../components/ui/StatusBadge'
import { StatusTimeline } from '../components/StatusTimeline'
import { Button } from '../components/ui/Button'
import { useStore } from '../lib/store'
import { formatDate, relativeTime } from '../lib/utils'
import { apiConfigured, listMyClaims } from '../lib/api/client'
import type { Item } from '../lib/types'

export function ClaimPage() {
  const { itemId } = useParams()
  const { user, items: storeItems, claims: storeClaims } = useStore()
  const [apiItem, setApiItem] = useState<Item | null>(null)
  const [apiClaims, setApiClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!apiConfigured()) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [itemRes, claimsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/items/${itemId}`),
          listMyClaims(),
        ])
        if (cancelled) return
        if (!itemRes.ok) {
          setLoading(false)
          return
        }
        const item = await itemRes.json()
        setApiItem(item as Item)
        setApiClaims(claimsRes)
      } catch {
        setLoading(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [itemId])

  if (loading) {
    return (
      <main className="container-x flex min-h-[60vh] flex-col items-center justify-center pb-24 pt-28 text-center">
        <p className="eyebrow">Claim &amp; Verification</p>
        <h1 className="h2-section mt-3">Loading…</h1>
      </main>
    )
  }

  const item = apiConfigured() ? apiItem : storeItems.find((i) => i.id === itemId)
  const existing = apiConfigured()
    ? apiClaims.find((c: any) => c.itemId === itemId && c.claimantId === user?.id)
    : storeClaims.find((c) => c.itemId === itemId && c.claimantId === user?.id)
  const claimable = item?.status !== 'returned' && item?.ownerId !== user?.id &&
    !apiClaims.some((claim: any) => claim.itemId === itemId && claim.status === 'approved') &&
    !storeClaims.some((claim) => claim.itemId === itemId && claim.status === 'approved')

  if (!item || item.type !== 'found') {
    return (
      <main className="container-x flex min-h-[60vh] flex-col items-center justify-center pb-24 pt-28 text-center">
        <h1 className="h2-section">Found item not available.</h1>
        <Button asChildLink="/discover?type=found" className="mt-6">
          Browse Found Items
        </Button>
      </main>
    )
  }

  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Claim &amp; Verification</p>
        <h1 className="h2-section mt-3">Claim “{item.title}”.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Answer the private ownership questions honestly. An authorized reviewer compares your
          answers before anything changes hands.
        </p>

        {existing ? (
          <section className="mt-10 rounded-[4px] border border-line bg-mist/60 p-6" aria-labelledby="claim-status">
            <div className="flex items-center justify-between gap-3">
              <h2 id="claim-status" className="font-semibold">
                Claim status
              </h2>
              <ClaimStatusBadge status={existing.status} />
            </div>
            <p className="mt-3 text-sm leading-relaxed">{existing.statement}</p>
            <dl className="mt-5 space-y-3 rounded-[3px] bg-paper p-4 text-sm">
              {existing.questions.map((q: any) => (
                <div key={q.id}>
                  <dt className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{q.question}</dt>
                  <dd className="mt-0.5 font-medium">{q.answer}</dd>
                </div>
              ))}
            </dl>
            {existing.adminNote && (
              <p className="mt-4 text-sm text-muted">Reviewer note: {existing.adminNote}</p>
            )}
            <p className="mt-4 text-xs text-muted">
              Submitted {formatDate(existing.createdAt)} · Last update {relativeTime(existing.updatedAt)}
            </p>
            <div className="mt-6 border-t border-line pt-6">
              <h3 className="text-sm font-semibold">Review progress</h3>
              <div className="mt-4">
                <StatusTimeline
                  events={[
                    {
                      id: 's1',
                      label: 'Claim submitted',
                      description: 'Answers saved in this browser',
                      date: existing.createdAt,
                      done: true,
                    },
                    {
                      id: 's2',
                      label: 'Human review',
                      description:
                        existing.status === 'pending'
                          ? 'Waiting for a reviewer'
                          : existing.status === 'under_review'
                            ? 'An authorized person is comparing answers'
                            : existing.status === 'approved'
                              ? 'Approved by a reviewer'
                              : 'Not approved',
                      date: existing.updatedAt,
                      done: existing.status !== 'pending',
                    },
                    {
                      id: 's3',
                      label: 'Verified handoff',
                      description: item.status === 'returned' && existing.status === 'approved'
                        ? 'Item returned to the approved claimant' : 'Arrange pickup once approved',
                      date: existing.updatedAt,
                      done: item.status === 'returned' && existing.status === 'approved',
                    },
                  ]}
                />
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChildLink="/dashboard?tab=claims" variant="secondary">
                Open Dashboard
              </Button>
              <Button asChildLink={`/items/${item.id}`} variant="ghost">
                Back to Item
              </Button>
            </div>
          </section>
        ) : !claimable ? (
          <p className="mt-10 rounded-[4px] border border-line bg-mist/60 p-8 text-center text-sm text-muted">
            This item is not available for a new claim.
          </p>
        ) : user ? (
          <div className="mt-10">
            <ClaimForm item={item} />
          </div>
        ) : (
          <div className="mt-10 rounded-[4px] border border-line bg-mist/60 p-8 text-center">
            <p className="font-medium">Sign in to submit a claim.</p>
            <p className="mt-2 text-sm text-muted">
              Claims are tracked against your account so you can follow review progress.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChildLink="/signin">Sign In</Button>
              <Button asChildLink={`/items/${item.id}`} variant="secondary">
                Back to Item
              </Button>
            </div>
          </div>
        )}

        <p className="mt-8 text-xs leading-relaxed text-muted">
          This demo saves answers in your browser and does not show them on public listings.{' '}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  )
}
