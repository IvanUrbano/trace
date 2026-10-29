import { Bell, ClipboardList, Handshake, LayoutList, PackageSearch } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClaimStatusBadge, StatusBadge } from '../components/ui/StatusBadge'
import { Button } from '../components/ui/Button'
import { useStore } from '../lib/store'
import { formatDate, relativeTime } from '../lib/utils'
import { cn } from '../lib/utils'

const tabs = [
  { id: 'lost', label: 'My Lost Reports', icon: PackageSearch },
  { id: 'found', label: 'My Found Reports', icon: ClipboardList },
  { id: 'claims', label: 'My Claims', icon: Handshake },
  { id: 'matches', label: 'Possible Matches', icon: LayoutList },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const

type TabId = (typeof tabs)[number]['id']

export function DashboardPage() {
  const { user, items, notificationsFor, markAllNotificationsRead, itemsByOwner, claimsByUser, signOut } = useStore()
  const [params, setParams] = useSearchParams()
  const active = (params.get('tab') as TabId) || 'lost'
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  if (!user) {
    return (
      <main className="container-x flex min-h-[60vh] flex-col items-center justify-center pb-24 pt-28 text-center">
        <p className="eyebrow">Dashboard</p>
        <h1 className="h2-section mt-3">Sign in to view your dashboard.</h1>
        <p className="mt-4 max-w-md text-muted">
          Track your lost and found reports, claims, possible matches, and notifications in one
          place.
        </p>
        <Button asChildLink="/signin" className="mt-8">
          Sign In
        </Button>
      </main>
    )
  }

  const myLost = itemsByOwner(user.id).filter((i) => i.type === 'lost')
  const myFound = itemsByOwner(user.id).filter((i) => i.type === 'found')
  const myClaims = claimsByUser(user.id)
  const notes = notificationsFor(user.id)
  const unread = notes.filter((n) => !n.read).length

  const matches = items
    .filter((i) => i.type === 'found' && i.status === 'unclaimed')
    .slice(0, 3)
    .map((item, idx) => ({
      item,
      score: [87, 62, 41][idx] ?? 35,
      label: idx === 0 ? 'Strong candidate' : idx === 1 ? 'Possible candidate' : 'Weak candidate',
    }))

  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="h2-section mt-3">Welcome back, {user.name.split(' ')[0]}.</h1>
        </div>
        <div className="flex gap-3">
          {user.role === 'admin' && (
            <Button asChildLink="/admin" variant="secondary">
              Admin
            </Button>
          )}
          <Button asChildLink="/report">New Report</Button>
          <Button variant="ghost" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Dashboard sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setParams({ tab: t.id })}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-[3px] px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
                active === t.id ? 'bg-ink text-paper' : 'text-muted hover:bg-mist hover:text-ink',
              )}
            >
              <t.icon className="h-4 w-4" strokeWidth={1.6} />
              {t.label}
              {t.id === 'notifications' && unread > 0 && (
                <span
                  className={cn(
                    'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                    active === t.id ? 'bg-paper text-ink' : 'bg-ink text-paper',
                  )}
                >
                  {unread}
                </span>
              )}
            </button>
          ))}
        </nav>

        <section aria-label="Dashboard content" className="min-w-0">
          {active === 'lost' && (
            <div className="space-y-4">
              {myLost.length === 0 && <EmptyState label="No lost reports yet." action="/report?type=lost" />}
              {myLost.map((item) => (
                <ReportRow key={item.id} item={item} onHistory={() => setHistoryFor(historyFor === item.id ? null : item.id)} showHistory={historyFor === item.id} />
              ))}
            </div>
          )}

          {active === 'found' && (
            <div className="space-y-4">
              {myFound.length === 0 && <EmptyState label="No found reports yet." action="/report?type=found" />}
              {myFound.map((item) => (
                <ReportRow key={item.id} item={item} onHistory={() => setHistoryFor(historyFor === item.id ? null : item.id)} showHistory={historyFor === item.id} />
              ))}
            </div>
          )}

          {active === 'claims' && (
            <div className="space-y-4">
              {myClaims.length === 0 && (
                <EmptyState label="You haven't submitted any claims." action="/discover?type=found" />
              )}
              {myClaims.map((c) => (
                <div key={c.id} className="rounded-[4px] border border-line bg-paper p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link to={`/items/${c.itemId}`} className="font-semibold tracking-tight hover:underline">
                      {c.itemTitle}
                    </Link>
                    <ClaimStatusBadge status={c.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{c.statement}</p>
                  <p className="mt-2 text-xs text-muted">
                    Submitted {formatDate(c.createdAt)}
                    {c.adminNote ? ` · Reviewer note: ${c.adminNote}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          {active === 'matches' && (
            <div>
              <p className="mb-4 text-sm text-muted">
                Illustrative similarity suggestions ranked by description, category, date, and
                location — not verified ownership.
              </p>
              <div className="space-y-4">
                {matches.map(({ item, score, label }) => (
                  <Link
                    key={item.id}
                    to={`/items/${item.id}`}
                    className="flex items-center gap-4 rounded-[4px] border border-line bg-paper p-4 transition-all hover:-translate-y-0.5 hover:border-ink"
                  >
                    <img src={item.images[0]} alt="" className="h-16 w-16 rounded-[3px] object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {item.location} · {formatDate(item.date)}
                      </p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">{label}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-semibold">{score}%</p>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-muted">illustrative</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {active === 'notifications' && (
            <div>
              <div className="mb-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={markAllNotificationsRead} disabled={unread === 0}>
                  Mark all read
                </Button>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-[4px] border border-line">
                {notes.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted">No notifications.</li>}
                {notes.map((n) => (
                  <li key={n.id} className={cn('flex items-start gap-3 px-5 py-4', !n.read && 'bg-mist/50')}>
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-line' : 'bg-ink')} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                      <p className="mt-1 text-xs text-muted">{relativeTime(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function EmptyState({ label, action }: { label: string; action: string }) {
  return (
    <div className="rounded-[3px] border border-dashed border-line bg-mist/40 px-6 py-14 text-center">
      <p className="text-sm font-medium">{label}</p>
      <Button asChildLink={action} variant="secondary" size="sm" className="mt-4">
        Create one
      </Button>
    </div>
  )
}

function ReportRow({
  item,
  onHistory,
  showHistory,
}: {
  item: ReturnType<typeof useStore>['items'][number]
  onHistory: () => void
  showHistory: boolean
}) {
  return (
    <div className="rounded-[4px] border border-line bg-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/items/${item.id}`} className="font-semibold tracking-tight hover:underline">
          {item.title}
        </Link>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {item.location} · {formatDate(item.date)}
      </p>
      <button
        onClick={onHistory}
        className="mt-3 text-sm font-medium underline underline-offset-4 hover:text-muted"
        aria-expanded={showHistory}
      >
        {showHistory ? 'Hide status history' : 'View status history'}
      </button>
      {showHistory && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {item.timeline.map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm">
              <span className={t.done ? 'font-medium' : 'text-muted'}>{t.label}</span>
              <span className="text-xs text-muted">{t.done ? formatDate(t.date) : 'Pending'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
