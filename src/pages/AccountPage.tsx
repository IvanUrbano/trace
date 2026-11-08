import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { cognitoEnabled, useCognitoSession } from '../lib/cognito'
import { apiConfigured } from '../lib/api/client'

/** Cloud mutations go through the live API when configured; otherwise show an unavailable notice. */
export function CloudAccess({ children, feature }: { children: ReactNode; feature: string }) {
  if (cognitoEnabled && !apiConfigured()) return <AccountPage feature={feature} />
  return <>{children}</>
}

export function AccountPage({ feature }: { feature?: string }) {
  const session = useCognitoSession()
  const location = useLocation()
  if (!session) return <Navigate to="/dashboard" replace />
  const { auth } = session
  if (auth.isLoading) return <main className="container-x pb-24 pt-32" role="status">Checking your account…</main>
  if (!auth.isAuthenticated) return <Navigate to={`/signin?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />
  const email = typeof auth.user?.profile.email === 'string' ? auth.user.profile.email : 'your TRACE account'
  return (
    <main className="container-x pb-24 pt-32">
      <div className="mx-auto max-w-xl">
        <p className="eyebrow">My Account</p>
        <h1 className="h2-section mt-4">{feature || 'Welcome to TRACE.'}</h1>
        <p className="mt-6 break-words text-sm">Signed in as {email}</p>
        <p className="mt-4 text-muted">{feature ? `${feature} is not available online yet.` : 'Your sign-in is ready.'} Online reports, claims, and reviewer tools are still being connected. You can browse the sample listings meanwhile.</p>
        {session.error && <p className="mt-4 text-sm" role="alert">{session.error}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChildLink="/discover">Browse Items</Button>
          <Button variant="secondary" disabled={session.busy} onClick={() => void session.logout()}>{session.busy ? 'Signing out…' : 'Sign Out'}</Button>
        </div>
      </div>
    </main>
  )
}
