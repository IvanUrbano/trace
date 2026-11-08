import type { CreateReportRequest } from '../contract/requests'

let configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
let accessTokenGetter: (() => string | null) | null = null

export function apiConfigured(): boolean {
  return configuredBaseUrl.length > 0
}

export function setAccessTokenGetter(getter: () => string | null) {
  accessTokenGetter = getter
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean

  constructor(status: number, code: string, message: string, retryable: boolean) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

async function readErrorBody(response: Response): Promise<{ code: string; message: string; retryable: boolean }> {
  try {
    const body = await response.json()
    const error = body && typeof body === 'object' && 'error' in body ? (body as { error?: unknown }).error : undefined
    return {
      code: error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : 'service_unavailable',
      message: error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : `Request failed with status ${response.status}`,
      retryable: error && typeof error === 'object' && 'retryable' in error ? Boolean((error as { retryable?: unknown }).retryable) : response.status >= 500,
    }
  } catch {
    return { code: 'service_unavailable', message: `Request failed with status ${response.status}`, retryable: response.status >= 500 }
  }
}

export async function apiFetch(path: string, options: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const { method = 'GET', body } = options
  const headers: Record<string, string> = { accept: 'application/json' }
  if (body) headers['content-type'] = 'application/json'

  const token = accessTokenGetter ? accessTokenGetter() : null
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(`${configuredBaseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const parsed = await readErrorBody(response)
    throw new ApiError(response.status, parsed.code, parsed.message, parsed.retryable)
  }

  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  return JSON.parse(text)
}

export async function submitReport(draft: CreateReportRequest): Promise<string> {
  // Photos are processed locally for preview but cloud storage is not connected yet.
  const body = { ...draft, images: [] }
  const result = await apiFetch('/api/reports', { method: 'POST', body })
  if (!result || typeof result !== 'object' || !('itemId' in result) || typeof (result as { itemId?: unknown }).itemId !== 'string') {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { itemId: string }).itemId
}
