import { z } from 'zod'

/**
 * API error model shared by the frontend and the future backend.
 * Every failed operation returns exactly one of these codes so the UI
 * can distinguish "not signed in" from "not allowed", "missing",
 * "invalid input", "state conflict", and "try again later".
 */

export const API_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'not_found',
  'validation',
  'conflict',
  'service_unavailable',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export interface ApiError {
  code: ApiErrorCode
  message: string
  /** Form field that failed validation, when applicable. */
  field?: string
  /** Whether an identical retry may succeed without changes. */
  retryable: boolean
}

export type OpResult<T> = { ok: true; value: T } | { ok: false; error: ApiError }

export const API_ERROR_HTTP_STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  service_unavailable: 503,
}

export function apiError(code: ApiErrorCode, message: string, field?: string): ApiError {
  return { code, message, field, retryable: code === 'service_unavailable' }
}

export function ok<T>(value: T): OpResult<T> {
  return { ok: true, value }
}

export function fail<T>(code: ApiErrorCode, message: string, field?: string): OpResult<T> {
  return { ok: false, error: apiError(code, message, field) }
}

export const apiErrorSchema = z.object({
  code: z.enum(API_ERROR_CODES),
  message: z.string().min(1),
  field: z.string().optional(),
  retryable: z.boolean(),
})

export const apiErrorResponseSchema = z.object({ error: apiErrorSchema })

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
