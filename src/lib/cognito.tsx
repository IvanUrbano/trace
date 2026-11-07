import { AuthProvider, useAuth, type AuthContextProps } from 'react-oidc-context'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cognitoLogoutUrl, safeReturnTo } from './authNavigation'

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim()
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim()
const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI?.trim() || window.location.origin + '/'
const domain = import.meta.env.VITE_COGNITO_DOMAIN?.trim()
const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI?.trim() || redirectUri

export const cognitoEnabled = Boolean(userPoolId && clientId)

const SessionContext = createContext<{
  auth: AuthContextProps
  busy: boolean
  error: string | null
  login: (destination?: string) => Promise<void>
  logout: () => Promise<void>
} | null>(null)

export const useCognitoSession = () => useContext(SessionContext)

function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = pending || auth.isLoading || Boolean(auth.activeNavigator)
  const login = async (destination = '/account') => {
    if (busy) return
    setPending(true)
    setError(null)
    try {
      await auth.signinRedirect({ state: { returnTo: safeReturnTo(destination) } })
    } catch {
      setError('Sign-in could not start. Please try again.')
    } finally { setPending(false) }
  }
  const logout = async () => {
    if (busy) return
    setPending(true)
    setError(null)
    try {
      if (!domain || !clientId) throw new Error('Missing logout configuration')
      const url = cognitoLogoutUrl(domain, clientId, logoutUri)
      auth.stopSilentRenew()
      await auth.removeUser()
      window.location.assign(url)
    } catch {
      setError('Sign-out could not finish. Please try again or check the login configuration.')
      setPending(false)
    }
  }
  return <SessionContext.Provider value={{ auth, busy, error, login, logout }}>{children}</SessionContext.Provider>
}

export function CognitoProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  if (!cognitoEnabled || !userPoolId || !clientId) return <>{children}</>

  return (
    <AuthProvider
      authority={`https://cognito-idp.ap-southeast-1.amazonaws.com/${userPoolId}`}
      client_id={clientId}
      redirect_uri={redirectUri}
      response_type="code"
      scope="openid email"
      onSigninCallback={(user) => {
        const state = user?.state as { returnTo?: unknown } | undefined
        navigate(safeReturnTo(state?.returnTo), { replace: true })
      }}
    >
      <SessionProvider>{children}</SessionProvider>
    </AuthProvider>
  )
}
