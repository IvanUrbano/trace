import { motion } from 'framer-motion'
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Tag } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ClaimForm } from '../components/ClaimForm'
import { QRScanner } from '../components/QRScanner'
import { StatusTimeline } from '../components/StatusTimeline'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useStore } from '../lib/store'
import { formatDate } from '../lib/utils'

export function ItemDetailsPage() {
  const { id } = useParams()
  const { items, user, toast } = useStore()
  const item = items.find((i) => i.id === id)
  const [activeImg, setActiveImg] = useState(0)

  if (!item) {
    return (
      <main className="container-x flex min-h-[60vh] flex-col items-center justify-center pb-24 pt-28 text-center">
        <p className="eyebrow">Not found</p>
        <h1 className="h2-section mt-3">This listing doesn&apos;t exist.</h1>
        <p className="mt-4 text-muted">It may have been returned or removed.</p>
        <Button asChildLink="/discover" className="mt-8">
          Back to Discover
        </Button>
      </main>
    )
  }

  const pageUrl = `${window.location.origin}/items/${item.id}`
  const isOwner = user?.id === item.ownerId

  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <Link
        to="/discover"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Discover
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div>
          <motion.div
            key={activeImg}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden rounded-[4px] border border-line bg-mist"
          >
            <img
              src={item.images[activeImg]}
              alt={item.title}
              className="aspect-[4/3] w-full object-cover"
            />
          </motion.div>
          {item.images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {item.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  aria-label={`View photo ${i + 1}`}
                  className={`overflow-hidden rounded-[3px] border transition-all ${
                    i === activeImg ? 'border-ink' : 'border-line opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={src} alt="" className="h-16 w-16 object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Description</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/90">{item.description}</p>
          </div>

          <div className="mt-10 border-t border-line pt-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Status timeline</h2>
            <div className="mt-6">
              <StatusTimeline events={item.timeline} />
            </div>
          </div>
        </div>

        <aside>
          <div className="lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{item.type === 'found' ? 'Found item' : 'Lost report'}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tightest">{item.title}</h1>
              </div>
              <StatusBadge status={item.status} />
            </div>

            <dl className="mt-8 space-y-4 border-y border-line py-6 text-sm">
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 text-muted" strokeWidth={1.5} />
                <dt className="sr-only">Category</dt>
                <dd>{item.category}</dd>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted" strokeWidth={1.5} />
                <dt className="sr-only">Location</dt>
                <dd>{item.location}</dd>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted" strokeWidth={1.5} />
                <dt className="sr-only">Date</dt>
                <dd>{formatDate(item.date)}</dd>
              </div>
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-muted">
              Private identifying details are withheld from public listings and used only during
              verification.
            </p>

            <div className="mt-8 space-y-3">
              {item.type === 'found' && item.status !== 'returned' && (
                <ClaimForm item={item} />
              )}
              {item.type === 'lost' && (
                <Button
                  asChildLink={`/report?type=found`}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  I May Have Found This
                </Button>
              )}
              {item.status === 'returned' && (
                <p className="inline-flex items-center gap-2 rounded-[3px] border border-line bg-mist px-4 py-3 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  This item has been returned to its owner.
                </p>
              )}
              {item.type === 'found' && !user && (
                <p className="text-xs text-muted">
                  You can browse as a guest — <Link to="/signin" className="underline underline-offset-4">sign in</Link> to submit a claim faster.
                </p>
              )}
              {isOwner && (
                <p className="rounded-[3px] border border-line bg-mist px-4 py-3 text-sm">
                  You reported this item. Manage it from your{' '}
                  <Link to="/dashboard" className="underline underline-offset-4">
                    dashboard
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="mt-10 rounded-[4px] border border-line bg-mist/60 p-6">
              <h3 className="text-sm font-semibold">Share this listing</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                Print or share the QR code so someone who finds a registered item can open this
                page instantly.
              </p>
              <div className="mt-4 inline-block rounded-[3px] bg-paper p-4">
                <QRCodeSVG value={pageUrl} size={132} level="M" />
              </div>
              <p className="mt-3 break-all font-mono text-[10px] text-muted">{pageUrl}</p>
              <div className="mt-5">
                <QRScanner
                  onScan={(text) => {
                    if (text.startsWith('http')) {
                      window.location.href = text
                    } else {
                      toast(`Scanned: ${text}`, 'info')
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
