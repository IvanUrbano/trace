/** Only known in-app destinations can survive the external login round trip. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\u0000-\u0020]/.test(value)) return '/account'
  try {
    const url = new URL(value, 'https://trace.invalid')
    if (url.origin !== 'https://trace.invalid') return '/account'
    if (!/^\/(account|report|dashboard|admin|discover|community|claim\/[^/]+|items\/[^/]+)?$/.test(url.pathname)) return '/account'
    return url.pathname + url.search + url.hash
  } catch { return '/account' }
}

export function cognitoLogoutUrl(domain: string, clientId: string, returnUrl: string): string {
  const url = new URL('/logout', domain)
  if (url.protocol !== 'https:') throw new Error('Cognito domain must use HTTPS')
  url.search = new URLSearchParams({ client_id: clientId, logout_uri: returnUrl }).toString()
  return url.href
}
