import { Link } from 'react-router-dom'
import { AdminReviewPanel } from '../components/AdminReviewPanel'
import { AuditLog } from '../components/AuditLog'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Button } from '../components/ui/Button'
import { useStore } from '../lib/store'
import { formatDate } from '../lib/utils'

export function AdminPage() {
  const { user, items, signOut } = useStore()

  if (!user || user.role !== 'admin') {
    return (
      <main className="container-x flex min-h-[60vh] flex-col items-center justify-center pb-24 pt-28 text-center">
        <p className="eyebrow">Admin</p>
        <h1 className="h2-section mt-3">Administrator access required.</h1>
        <p className="mt-4 max-w-md text-muted">
          Claim decisions and handoff confirmations require an authorized administrator. Sign in
          with <code className="font-mono">admin@trace.app</code> to open the review queue.
        </p>
        <Button asChildLink="/signin" className="mt-8">
          Sign In as Admin
        </Button>
      </main>
    )
  }

  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="h2-section mt-3">Review queue.</h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Signed in as {user.name}. Ownership is never approved automatically — every decision
            is made here and recorded in the audit log.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChildLink="/dashboard" variant="secondary">
            User Dashboard
          </Button>
          <Button variant="ghost" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>

      <div className="mt-12">
        <AdminReviewPanel />
      </div>

      <section className="mt-16" aria-labelledby="item-reports-heading">
        <h2 id="item-reports-heading" className="text-lg font-semibold tracking-tight">
          Item reports
        </h2>
        <div className="mt-6 overflow-x-auto rounded-[4px] border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-mist/60">
              <tr>
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Reporter</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item, i) => (
                <tr key={item.id} className={i % 2 ? 'bg-mist/30' : 'bg-paper'}>
                  <td className="px-5 py-3.5">
                    <Link to={`/items/${item.id}`} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 capitalize">{item.type}</td>
                  <td className="px-5 py-3.5">{item.ownerName}</td>
                  <td className="px-5 py-3.5">{item.location}</td>
                  <td className="px-5 py-3.5">{formatDate(item.date)}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-16">
        <AuditLog />
      </div>
    </main>
  )
}
