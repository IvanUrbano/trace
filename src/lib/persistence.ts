import { migrateTraceData, type TraceData } from './service/domain.ts'
import type { User } from './types'

export const STORAGE_KEY = 'trace_state_v2'
export const USER_STORAGE_KEY = 'trace_state_v2_user'

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadDemoData(storage: BrowserStorage, seeds: TraceData) {
  try {
    const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem('trace_state_v1')
    if (raw === null) return { data: seeds, error: '' }
    const data = migrateTraceData(JSON.parse(raw))
    if (data) return { data, error: '' }
    return { data: seeds, error: 'Saved demo data is damaged. Sample data is shown; changes are blocked to preserve your saved records.' }
  } catch {
    return { data: seeds, error: 'Saved demo data could not be read. Sample data is shown; changes are blocked to preserve your saved records.' }
  }
}

/** Save before publishing state or reporting success. A failed write leaves memory unchanged. */
export function saveDemoData(storage: BrowserStorage, data: TraceData): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function loadDemoUser(storage: BrowserStorage): User | null {
  try {
    const raw = storage.getItem(USER_STORAGE_KEY) ?? storage.getItem('trace_state_v1_user')
    if (raw === null) return null
    const user = JSON.parse(raw) as User | null
    if (!user || typeof user.name !== 'string' || !user.name.trim() ||
      typeof user.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) return null
    const email = user.email.trim().toLowerCase()
    const expectedId = email === 'alex@example.com' ? 'u_demo' : email === 'admin@trace.app' ? 'u_admin' : `u_${email}`
    const expectedRole = email === 'admin@trace.app' ? 'admin' : 'user'
    // Ambiguous old sessions must sign in again; never reassign their old reports.
    if (user.id !== expectedId || user.role !== expectedRole) return null
    return { ...user, email }
  } catch {
    return null
  }
}
