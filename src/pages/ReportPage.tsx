import { ReportForm } from '../components/ReportForm'
import { useStore } from '../lib/store'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'

export function ReportPage() {
  const { user } = useStore()
  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Report</p>
        <h1 className="h2-section mt-3">Tell us about the item.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          A clear description and approximate location make matches far more likely. You can
          report something you lost or something you found.
        </p>
        {user ? (
          <div className="mt-12">
            <ReportForm />
          </div>
        ) : (
          <div className="mt-12 rounded-[4px] border border-line bg-mist/60 p-8 text-center">
            <p className="font-medium">Sign in to submit a report.</p>
            <p className="mt-2 text-sm text-muted">
              Reports are tied to your account so you can track status and receive match
              notifications.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChildLink="/signin">Sign In</Button>
              <Button asChildLink="/discover" variant="secondary">
                Browse Instead
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted">
              Demo app — any email works. Use <code className="font-mono">admin@trace.app</code> for
              the admin role.{' '}
              <Link to="/signin" className="underline underline-offset-4">
                Continue
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
