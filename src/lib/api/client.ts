import type { CreateReportRequest, SubmitClaimRequest } from '../contract/requests'

let configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
let accessTokenGetter: (() => string | null) | null = null

export function apiConfigured(): boolean {
  return configuredBaseUrl.length > 0
}

export function setAccessTokenGetter(getter: () => string | null) {
  accessTokenGetter = getter
}

function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
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

export async function apiFetch(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<unknown> {
  const { method = 'GET', body, headers: extraHeaders } = options
  const headers: Record<string, string> = { accept: 'application/json' }
  if (body) headers['content-type'] = 'application/json'
  for (const [key, value] of Object.entries(extraHeaders ?? {})) headers[key] = value

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
  // Photos are uploaded to S3 first; the object keys are submitted with the report.
  const result = await apiFetch('/api/reports', { method: 'POST', body: draft })
  if (!result || typeof result !== 'object' || !('itemId' in result) || typeof (result as { itemId?: unknown }).itemId !== 'string') {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { itemId: string }).itemId
}

export async function requestPhotoUpload(file: File): Promise<{ objectKey: string; uploadUrl: string; expiresAt: string }> {
  const result = await apiFetch('/api/photos/presign', {
    method: 'POST',
    body: {
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    },
  })
  if (!result || typeof result !== 'object' || !('objectKey' in result) || !('uploadUrl' in result)) {
    throw new ApiError(502, 'service_unavailable', 'Unexpected presign response.', true)
  }
  return result as { objectKey: string; uploadUrl: string; expiresAt: string }
}

export async function uploadPhotoToS3(file: File, uploadUrl: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': file.type },
  })
  if (!response.ok) throw new Error(`Photo upload failed with status ${response.status}`)
}

export async function submitClaim(draft: SubmitClaimRequest): Promise<string> {
  const result = await apiFetch('/api/claims', { method: 'POST', body: draft })
  if (!result || typeof result !== 'object' || !('claimId' in result) || typeof (result as { claimId?: unknown }).claimId !== 'string') {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { claimId: string }).claimId
}

export async function listMyClaims(): Promise<unknown[]> {
  const result = await apiFetch('/api/me/claims')
  if (!result || typeof result !== 'object' || !Array.isArray((result as { claims?: unknown }).claims)) {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { claims: unknown[] }).claims
}

export async function listMyReports(): Promise<unknown[]> {
  const result = await apiFetch('/api/me/reports')
  if (!result || typeof result !== 'object' || !Array.isArray((result as { items?: unknown }).items)) {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { items: unknown[] }).items
}

export async function listMatches(lostReportId: string): Promise<unknown[]> {
  const result = await apiFetch(`/api/me/matches${queryString({ lostReportId })}`)
  if (!result || typeof result !== 'object' || !Array.isArray((result as { matches?: unknown }).matches)) {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { matches: unknown[] }).matches
}

export async function listNotifications(): Promise<unknown[]> {
  const result = await apiFetch('/api/me/notifications')
  if (!result || typeof result !== 'object' || !Array.isArray((result as { notifications?: unknown }).notifications)) {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { notifications: unknown[] }).notifications
}

export async function markNotificationsRead(): Promise<number> {
  const result = await apiFetch('/api/me/notifications/read', { method: 'POST' })
  if (!result || typeof result !== 'object' || typeof (result as { updated?: unknown }).updated !== 'number') {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { updated: number }).updated
}

export async function listReviewQueue(): Promise<unknown[]> {
  const result = await apiFetch('/api/admin/review-queue')
  if (!result || typeof result !== 'object' || !Array.isArray((result as { claims?: unknown }).claims)) {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return (result as { claims: unknown[] }).claims
}

export async function getReviewEvidence(claimId: string): Promise<unknown> {
  const result = await apiFetch(`/api/admin/claims/${encodeURIComponent(claimId)}/evidence`)
  if (!result || typeof result !== 'object') {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return result
}

export async function reviewClaim(claimId: string, decision: 'under_review' | 'approved' | 'rejected', note?: string): Promise<unknown> {
  const result = await apiFetch(`/api/admin/claims/${encodeURIComponent(claimId)}/review`, {
    method: 'POST',
    body: { decision, note },
  })
  if (!result || typeof result !== 'object') {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return result
}

export async function recordHandoff(itemId: string, claimId: string, note: string, idempotencyKey: string): Promise<unknown> {
  const headers: Record<string, string> = { 'idempotency-key': idempotencyKey }
  const result = await apiFetch('/api/admin/handoffs', { method: 'POST', body: { itemId, claimId, note }, headers })
  if (!result || typeof result !== 'object') {
    throw new ApiError(502, 'service_unavailable', 'Unexpected server response.', true)
  }
  return result
}
