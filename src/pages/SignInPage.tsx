import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { signInSchema, type SignInInput } from '../lib/schemas'
import { useStore } from '../lib/store'
import { cognitoEnabled, useCognitoSession } from '../lib/cognito'
import { safeReturnTo } from '../lib/authNavigation'

function CognitoSignInPage() {
  const session = useCognitoSession()!
  const { auth } = session
  const [params] = useSearchParams()
  const destination = safeReturnTo(params.get('returnTo'))
  if (!auth.isLoading && auth.isAuthenticated) return <Navigate to={destination} replace />

  return (
    <main className="container-x flex min-h-[80vh] items-center justify-center pb-24 pt-28">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow">Secure account</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tightest">Sign in to TRACE.</h1>
        {auth.isLoading && <p className="mt-4 text-sm text-muted" role="status">Checking your secure session…</p>}
        {(auth.error || session.error) && <p className="mt-4 text-sm text-red-700" role="alert">{session.error || 'Sign-in could not be completed. Try again.'}</p>}
        <p className="mt-4 text-sm text-muted">Sign in with your invited TRACE account.</p>
        <Button type="button" size="lg" className="mt-8 w-full" disabled={session.busy} onClick={() => void session.login(destination)}>
          {session.busy ? 'Connecting…' : 'Continue to Sign In'} <ArrowRight className="h-4 w-4" />
        </Button>
        <Link to="/" className="mt-6 inline-block text-sm underline">Back to homepage</Link>
      </div>
    </main>
  )
}

export function SignInPage() {
  return cognitoEnabled ? <CognitoSignInPage /> : <DemoSignInPage />
}

function DemoSignInPage() {
  const { signIn } = useStore()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), mode: 'onTouched' })

  const onSubmit = async (data: SignInInput) => {
    if (!signIn(data.email, data.name)) return
    const isAdmin = data.email.trim().toLowerCase() === 'admin@trace.app'
    navigate(isAdmin ? '/admin' : '/dashboard')
  }

  return (
    <main className="container-x flex min-h-[80vh] items-center justify-center pb-24 pt-28">
      <div className="w-full max-w-md">
        <p className="eyebrow text-center">Account</p>
        <h1 className="mt-3 text-center text-3xl font-semibold tracking-tightest">
          {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
        </h1>
        <p className="mt-3 text-center text-sm text-muted">
          Demo authentication — no password required. Any email signs you in as a user.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-10 space-y-5">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Full name
              </label>
              <input
                id="name"
                {...register('name')}
                placeholder="Alex Rivera"
                className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm focus:border-ink"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-[3px] border border-line bg-paper px-4 py-3 text-sm focus:border-ink"
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs font-medium" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 rounded-[3px] border border-line bg-mist/60 p-4 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-ink">Demo roles</p>
          <p className="mt-1">
            Use <code className="font-mono">admin@trace.app</code> to sign in as an administrator
            with claim review powers. Any other email works as a standard user.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'signin' ? 'New to TRACE?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="font-medium text-ink underline underline-offset-4"
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <p className="mt-3 text-center text-sm">
          <Link to="/" className="text-muted hover:text-ink">
            ← Back home
          </Link>
        </p>
      </div>
    </main>
  )
}
