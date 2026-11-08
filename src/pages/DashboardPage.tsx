import { Bell, ClipboardList, Handshake, LayoutList, PackageSearch } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClaimStatusBadge, StatusBadge } from '../components/ui/StatusBadge'
import { Button } from '../components/ui/Button'
import { useStore } from '../lib/store'
import { useCognitoSession } from '../lib/cognito'
import { rankFoundMatches } from '../lib/matching'
import { formatDate, relativeTime } from '../lib/utils'
import { cn } from '../lib/utils'
import { apiConfigured, listMyReports, listMyClaims, listMatches, listNotifications, markNotificationsRead } from '../lib/api/client'

const tabs = [
  { id: 'lost', label: 'My Lost Reports', icon: PackageSearch },
  { id: 'found', label: 'My Found Reports', icon: ClipboardList },
  { id: 'claims', label: 'My Claims', icon: Handshake },
  { id: 'matches', label: 'Possible Matches', icon: LayoutList },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const

type TabId = (typeof tabs)[number]['id']

export function DashboardPage() {
  const { user, signOut, items, itemsByOwner, claimsByUser, notificationsFor } = useStore()
  const session = useCognitoSession()
  const cognitoMode = Boolean(session)
  const [params, setParams] = useSearchParams()
  const active = (params.get('tab') as TabId) || 'lost'
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  // API mode state
  const [apiItems, setApiItems] = useState<any[]>([])
  const [apiClaims, setApiClaims] = useState<any[]>([])
  const [apiNotifications, setApiNotifications] = useState<any[]>([])
  const [apiMatchGroups, setApiMatchGroups] = useState<{ lost: any; matches: any[] }[]>([])
  const [loading, setLoading] = useState(apiConfigured())

  useEffect(() => {
    if (!apiConfigured()) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [reportsRes, claimsRes, notificationsRes] = await Promise.all([
          listMyReports(),
          listMyClaims(),
          listNotifications(),
        ])
        if (cancelled) return
        setApiItems(reportsRes)
        setApiClaims(claimsRes)
        setApiNotifications(notificationsRes)

        // Load matches for each lost report
        const lostReports = (reportsRes as any[]).filter((r) => r.type === 'lost' && r.status !== 'returned')
        const groups: { lost: any; matches: any[] }[] = []
        for (const lost of lostReports) {
          if (cancelled) return
          const matches = await listMatches(lost.id)
          groups.push({ lost, matches })
        }
        if (!cancelled) setApiMatchGroups(groups)
      } catch {
        // fall through, data stays empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <main className="container-x flex min-h-[60vh] flex-col items-center justify-center pb-24 pt-28 text-center">
        <p className="eyebrow">Dashboard</p>
        <h1 className="h2-section mt-3">Loading…</h1>
      </main>
    )
  }

  if (cognitoMode && !session!.auth.isAuthenticated) {
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

  if (!cognitoMode && !user) {
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

  const displayName = cognitoMode
    ? (typeof session!.auth.user?.profile.email === 'string' ? session!.auth.user.profile.email : 'your TRACE account')
    : (user?.name ?? 'your TRACE account')
  const myLost = apiConfigured()
    ? apiItems.filter((i: any) => i.type === 'lost')
    : user ? itemsByOwner(user.id).filter((i) => i.type === 'lost') : []
  const myFound = apiConfigured()
    ? apiItems.filter((i: any) => i.type === 'found')
    : user ? itemsByOwner(user.id).filter((i) => i.type === 'found') : []
  const myClaims = apiConfigured() ? apiClaims : (user ? claimsByUser(user.id) : [])
  const notes = apiConfigured() ? apiNotifications : (user ? notificationsFor(user.id) : [])
  const unread = notes.filter((n: any) => !n.read).length

  const matchGroups = apiConfigured() ? apiMatchGroups : items.filter((i) => i.type === 'lost' && i.status !== 'returned').map((item: any) => ({ lost: item, matches: rankFoundMatches(item, items) }))

  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
            <h1 className="h2-section mt-3">Welcome back, {displayName.split(' ')[0]}.</h1>
        </div>
        <div className="flex gap-3">
          {(user?.role === 'admin' || (Array.isArray(session?.auth.user?.profile?.['cognito:groups']) && (session?.auth.user?.profile?.['cognito:groups'] as string[]).includes('admin'))) && (
            <Button asChildLink="/admin" variant="secondary">
              Admin
            </Button>
          )}
          <Button asChildLink="/report">New Report</Button>
          <Button variant="ghost" onClick={cognitoMode ? () => void session!.logout() : signOut} disabled={cognitoMode && session!.busy}>
            {cognitoMode && session!.busy ? 'Signing out…' : 'Sign Out'}
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
              {myLost.map((item: any) => (
                <ReportRow key={item.id} item={item} onHistory={() => setHistoryFor(historyFor === item.id ? null : item.id)} showHistory={historyFor === item.id} />
              ))}
            </div>
          )}

          {active === 'found' && (
            <div className="space-y-4">
              {myFound.length === 0 && <EmptyState label="No found reports yet." action="/report?type=found" />}
              {myFound.map((item: any) => (
                <ReportRow key={item.id} item={item} onHistory={() => setHistoryFor(historyFor === item.id ? null : item.id)} showHistory={historyFor === item.id} />
              ))}
            </div>
          )}

          {active === 'claims' && (
            <div className="space-y-4">
              {myClaims.length === 0 && (
                <EmptyState label="You haven't submitted any claims." action="/discover?type=found" />
              )}
              {myClaims.map((c: any) => (
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
                Scores rank suggestions from public descriptions, category, date, and location.
                They are not ownership probabilities. A person verifies every claim.
              </p>
              {matchGroups.length === 0 && <EmptyState label="Report a lost item to see possible matches." action="/report?type=lost" />}
              <div className="space-y-8">
                {matchGroups.map(({ lost, matches }: any) => (
                  <section key={lost.id} aria-label={`Matches for ${lost.title}`}>
                    <h2 className="mb-3 text-sm font-semibold">
                      Possible matches for <Link to={`/items/${lost.id}`} className="underline underline-offset-4">{lost.title}</Link>
                    </h2>
                    {matches.length === 0 ? (
                      <p className="rounded-[4px] border border-dashed border-line bg-mist/40 px-5 py-7 text-sm text-muted">
                        No found reports in this category yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {matches.map(({ item, score, reasons }: any) => (
                          <Link
                            key={item.id}
                            to={`/items/${item.id}`}
                            className="flex items-center gap-4 rounded-[4px] border border-line bg-paper p-4 transition-all hover:-translate-y-0.5 hover:border-ink"
                          >
                            {item.images.length ? <img src={item.images[0]} alt="" className="h-16 w-16 rounded-[3px] object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[3px] bg-mist text-center text-xs text-muted">No photo</div>}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{item.title}</p>
                              <p className="mt-0.5 text-sm text-muted">{item.location} · {formatDate(item.date)}</p>
                              <p className="mt-1 text-xs text-muted">{reasons.join(' · ')}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-mono text-lg font-semibold">{score}</p>
                              <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Match score</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}

          {active === 'notifications' && (
            <div>
              <div className="mb-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => {
                  if (apiConfigured()) {
                    markNotificationsRead().then(() => {
                      setApiNotifications(apiNotifications.map((n: any) => ({ ...n, read: true })))
                    })
                  } else {
                    const { markAllNotificationsRead } = useStore()
                    markAllNotificationsRead()
                  }
                }} disabled={unread === 0}>
                  Mark all read
                </Button>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-[4px] border border-line">
                {notes.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted">No notifications.</li>}
                {notes.map((n: any) => (
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
  item: any
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
          {item.timeline.map((t: any) => (
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
