import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  type CreateReportRequest,
  type SubmitClaimRequest,
} from './contract'
import {
  DEMO_ADMIN,
  DEMO_USER,
  SEED_AUDIT,
  SEED_CLAIMS,
  SEED_ITEMS,
  SEED_NOTIFICATIONS,
} from './demoData'
import {
  createReport,
  markAllNotificationsRead as markAllNotificationsReadOp,
  recordHandoff,
  reviewClaim,
  submitClaim as submitClaimOp,
  type TraceData,
} from './service/domain'
import type { AuditEntry, Claim, ClaimStatus, Item, Notification, User } from './types'
import { uid } from './utils'
import { cognitoEnabled } from './cognito'
import { loadDemoData, loadDemoUser, saveDemoData, USER_STORAGE_KEY } from './persistence'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

type ReviewableClaimStatus = Exclude<ClaimStatus, 'pending'>

interface AppState {
  user: User | null
  items: Item[]
  claims: Claim[]
  notifications: Notification[]
  audit: AuditEntry[]
  toasts: Toast[]
  signIn: (email: string, name?: string) => boolean
  signOut: () => void
  addItem: (draft: CreateReportRequest) => string | null
  submitClaim: (draft: SubmitClaimRequest) => boolean
  updateClaimStatus: (claimId: string, status: ReviewableClaimStatus, note?: string) => boolean
  markReturned: (itemId: string, claimId: string, note: string) => boolean
  markAllNotificationsRead: () => void
  toast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void
  itemsByOwner: (ownerId: string) => Item[]
  claimsByUser: (userId: string) => Claim[]
  notificationsFor: (userId: string) => Notification[]
}

const StoreContext = createContext<AppState | null>(null)

function load() {
  const seeds = {
    items: SEED_ITEMS,
    claims: SEED_CLAIMS,
    notifications: SEED_NOTIFICATIONS,
    audit: SEED_AUDIT,
  }
  return loadDemoData({ getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }, seeds)
}

function loadUser(): User | null {
  if (cognitoEnabled) return null
  try {
    return loadDemoUser(localStorage)
  } catch {
    return null
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(load)
  const [data, setData] = useState<TraceData>(loaded.data)
  const dataRef = useRef(data)
  const [user, setUser] = useState<User | null>(loadUser)
  const [toasts, setToasts] = useState<Toast[]>(loaded.error
    ? [{ id: 'storage-error', message: loaded.error, type: 'error' }]
    : [])

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = uid('toast')
    setToasts((t) => [...t, { id, message, type }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const commit = useCallback((nextData: TraceData) => {
    if (loaded.error) {
      toast(loaded.error, 'error')
      return false
    }
    try {
      if (!saveDemoData(localStorage, nextData)) throw new Error('Storage unavailable')
    } catch {
      toast('Changes were not saved. Browser storage is full or unavailable. Free space and try again.', 'error')
      return false
    }
    dataRef.current = nextData
    setData(nextData)
    return true
  }, [loaded.error, toast])

  const signIn = useCallback(
    (email: string, name?: string) => {
      if (cognitoEnabled) return false
      const normalizedEmail = email.trim().toLowerCase()
      const isAdmin = normalizedEmail === DEMO_ADMIN.email
      const u: User = isAdmin
        ? DEMO_ADMIN
        : normalizedEmail === DEMO_USER.email
          ? { ...DEMO_USER, name: name?.trim() || DEMO_USER.name }
          : {
              id: `u_${normalizedEmail}`,
              email: normalizedEmail,
              name: name?.trim() || normalizedEmail.split('@')[0],
              role: 'user',
            }
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u))
      } catch {
        toast('Could not save your demo session. Check browser storage and try again.', 'error')
        return false
      }
      setUser(u)
      toast(isAdmin ? 'Signed in as administrator' : `Welcome back, ${u.name}`)
      return true
    },
    [toast],
  )

  const signOut = useCallback(() => {
    try {
      // A tombstone prevents a legacy session from reappearing on reload.
      localStorage.setItem(USER_STORAGE_KEY, 'null')
    } catch {
      toast('Could not save sign-out. Close this browser session or clear its site data.', 'error')
      setUser(null)
      return
    }
    setUser(null)
    toast('Signed out', 'info')
  }, [toast])

  const addItem = useCallback(
    (draft: CreateReportRequest): string | null => {
      if (!user) {
        toast('Sign in to submit a report', 'error')
        return null
      }
      const outcome = createReport(dataRef.current, user, draft)
      if (!outcome.result.ok) {
        toast(outcome.result.error.message, 'error')
        return null
      }
      if (!commit(outcome.data)) return null
      toast(draft.type === 'lost' ? 'Lost item report submitted' : 'Found item report submitted')
      return outcome.result.value
    },
    [user, commit, toast],
  )

  const submitClaim = useCallback(
    (draft: SubmitClaimRequest): boolean => {
      if (!user) {
        toast('Sign in to submit a claim', 'error')
        return false
      }
      const outcome = submitClaimOp(dataRef.current, user, draft)
      if (!outcome.result.ok) {
        toast(outcome.result.error.message, 'error')
        return false
      }
      if (!commit(outcome.data)) return false
      toast('Claim submitted for review')
      return true
    },
    [user, commit, toast],
  )

  const updateClaimStatus = useCallback(
    (claimId: string, status: ReviewableClaimStatus, note?: string): boolean => {
      if (!user) {
        toast('This claim cannot be updated', 'error')
        return false
      }
      const outcome = reviewClaim(dataRef.current, user, claimId, { decision: status, note })
      if (!outcome.result.ok) {
        toast(outcome.result.error.message, 'error')
        return false
      }
      if (!commit(outcome.data)) return false
      toast(
        status === 'approved' ? 'Claim approved' : status === 'rejected' ? 'Claim declined' : 'Claim moved to review',
      )
      return true
    },
    [user, commit, toast],
  )

  const markReturned = useCallback(
    (itemId: string, claimId: string, note: string): boolean => {
      if (!user) {
        toast('An approved claim and handoff note are required', 'error')
        return false
      }
      const outcome = recordHandoff(dataRef.current, user, { itemId, claimId, note })
      if (!outcome.result.ok) {
        toast(outcome.result.error.message, 'error')
        return false
      }
      if (!commit(outcome.data)) return false
      toast('Handoff recorded — item returned')
      return true
    },
    [user, commit, toast],
  )

  const markAllNotificationsRead = useCallback(() => {
    if (!user) return
    const outcome = markAllNotificationsReadOp(dataRef.current, user)
    if (outcome.result.ok) commit(outcome.data)
  }, [user, commit])

  const itemsByOwner = useCallback(
    (ownerId: string) => data.items.filter((item) => item.ownerId === ownerId),
    [data.items],
  )
  const claimsByUser = useCallback(
    (userId: string) => data.claims.filter((claim) => claim.claimantId === userId),
    [data.claims],
  )
  const notificationsFor = useCallback(
    (userId: string) => data.notifications.filter((notification) => notification.userId === userId),
    [data.notifications],
  )

  const value = useMemo<AppState>(
    () => ({
      user,
      items: data.items,
      claims: data.claims,
      notifications: data.notifications,
      audit: data.audit,
      toasts,
      signIn,
      signOut,
      addItem,
      submitClaim,
      updateClaimStatus,
      markReturned,
      markAllNotificationsRead,
      toast,
      dismissToast,
      itemsByOwner,
      claimsByUser,
      notificationsFor,
    }),
    [
      user, data, toasts, signIn, signOut, addItem, submitClaim, updateClaimStatus, markReturned,
      markAllNotificationsRead, toast, dismissToast, itemsByOwner, claimsByUser, notificationsFor,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
