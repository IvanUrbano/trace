import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEMO_ADMIN,
  DEMO_USER,
  SEED_AUDIT,
  SEED_CLAIMS,
  SEED_ITEMS,
  SEED_NOTIFICATIONS,
} from './demoData'
import type { AuditEntry, Claim, Item, Notification, User } from './types'
import { uid } from './utils'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppState {
  user: User | null
  items: Item[]
  claims: Claim[]
  notifications: Notification[]
  audit: AuditEntry[]
  toasts: Toast[]
  signIn: (email: string, name?: string) => void
  signOut: () => void
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'timeline' | 'ownerId' | 'ownerName'> & { privateDetails?: string }) => string | null
  submitClaim: (claim: Omit<Claim, 'id' | 'createdAt' | 'updatedAt' | 'claimantId' | 'claimantName' | 'status'>) => boolean
  updateClaimStatus: (claimId: string, status: Claim['status'], note?: string) => boolean
  markReturned: (itemId: string, claimId: string, note: string) => boolean
  markAllNotificationsRead: () => void
  toast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void
  itemsByOwner: (ownerId: string) => Item[]
  claimsByUser: (userId: string) => Claim[]
  notificationsFor: (userId: string) => Notification[]
}

const StoreContext = createContext<AppState | null>(null)

const STORAGE_KEY = 'trace_state_v1'

interface Persisted {
  items: Item[]
  claims: Claim[]
  notifications: Notification[]
  audit: AuditEntry[]
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Persisted
      if (Array.isArray(saved.items) && Array.isArray(saved.claims) &&
        Array.isArray(saved.notifications) && Array.isArray(saved.audit)) return saved
    }
  } catch {
    /* fall through to seeds */
  }
  return {
    items: SEED_ITEMS,
    claims: SEED_CLAIMS,
    notifications: SEED_NOTIFICATIONS,
    audit: SEED_AUDIT,
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, [])
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_user`)
      if (!raw) return null
      const saved = JSON.parse(raw) as User
      return saved && typeof saved.id === 'string' && typeof saved.email === 'string' &&
        (saved.role === 'user' || saved.role === 'admin') ? saved : null
    } catch {
      return null
    }
  })
  const [items, setItems] = useState<Item[]>(initial.items)
  const [claims, setClaims] = useState<Claim[]>(initial.claims)
  const [notifications, setNotifications] = useState<Notification[]>(initial.notifications)
  const [audit, setAudit] = useState<AuditEntry[]>(initial.audit)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, claims, notifications, audit }))
    } catch {
      setToasts((current) => current.some((entry) => entry.id === 'storage-error') ? current : [
        ...current,
        { id: 'storage-error', message: 'Browser storage is full. Recent changes may not be saved.', type: 'error' },
      ])
    }
  }, [items, claims, notifications, audit])

  useEffect(() => {
    try {
      if (user) localStorage.setItem(`${STORAGE_KEY}_user`, JSON.stringify(user))
      else localStorage.removeItem(`${STORAGE_KEY}_user`)
    } catch {
      setToasts((current) => current.some((entry) => entry.id === 'storage-error') ? current : [
        ...current,
        { id: 'storage-error', message: 'Browser storage is unavailable. Your session may not persist.', type: 'error' },
      ])
    }
  }, [user])

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = uid('toast')
    setToasts((t) => [...t, { id, message, type }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const logAudit = useCallback(
    (actor: string, action: string, target: string, detail?: string) => {
      setAudit((a) => [
        { id: uid('audit'), actor, action, target, timestamp: new Date().toISOString(), detail },
        ...a,
      ])
    },
    [],
  )

  const signIn = useCallback(
    (email: string, name?: string) => {
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
      setUser(u)
      toast(isAdmin ? 'Signed in as administrator' : `Welcome back, ${u.name}`)
    },
    [toast],
  )

  const signOut = useCallback(() => {
    setUser(null)
    toast('Signed out', 'info')
  }, [toast])

  const addItem: AppState['addItem'] = useCallback(
    (draft) => {
      if (!user) {
        toast('Sign in to submit a report', 'error')
        return null
      }
      const id = uid('item')
      const item: Item = {
        ...draft,
        id,
        ownerId: user.id,
        ownerName: user.name,
        createdAt: new Date().toISOString(),
        timeline: [
          {
            id: uid('tl'),
            label: draft.type === 'lost' ? 'Reported lost' : 'Reported found',
            description: 'Report submitted',
            date: new Date().toISOString(),
            done: true,
          },
          {
            id: uid('tl'),
            label: draft.type === 'lost' ? 'Matching in progress' : 'Listed publicly',
            description: draft.type === 'lost' ? 'Possible matches will surface here' : 'Visible on Discover',
            date: new Date().toISOString(),
            done: draft.type === 'found',
          },
          {
            id: uid('tl'),
            label: draft.type === 'lost' ? 'Match found' : 'Awaiting claim',
            description: draft.type === 'lost' ? 'Awaiting verification' : 'No claims yet',
            date: new Date().toISOString(),
            done: false,
          },
          {
            id: uid('tl'),
            label: draft.type === 'lost' ? 'Returned' : 'Verified handoff',
            description: 'Pending verification',
            date: new Date().toISOString(),
            done: false,
          },
        ],
      }
      setItems((prev) => [item, ...prev])
      logAudit(user.name, 'item.reported', item.title, `${item.type} report created`)
      toast(draft.type === 'lost' ? 'Lost item report submitted' : 'Found item report submitted')
      return id
    },
    [user, logAudit, toast],
  )

  const submitClaim: AppState['submitClaim'] = useCallback(
    (draft) => {
      const item = items.find((candidate) => candidate.id === draft.itemId)
      if (!user || !item || item.type !== 'found' || item.status === 'returned' ||
        item.ownerId === user.id || claims.some((claim) => claim.itemId === item.id &&
          (claim.claimantId === user.id || claim.status === 'approved'))) {
        toast('This item is not available for a new claim', 'error')
        return false
      }
      const claim: Claim = {
        ...draft,
        id: uid('claim'),
        itemTitle: item.title,
        claimantId: user.id,
        claimantName: user.name,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setClaims((prev) => [claim, ...prev])
      setItems((prev) =>
        prev.map((i) =>
          i.id === draft.itemId
            ? {
                ...i,
                status: 'claim_pending',
                timeline: i.timeline.map((t, idx) =>
                  idx === 2
                    ? { ...t, label: 'Claim submitted', description: 'Awaiting review', done: true }
                    : t,
                ),
              }
            : i,
        ),
      )
      setNotifications((prev) => [
        {
          id: uid('n'),
          userId: user.id,
          title: 'Claim submitted',
          message: `Your claim for “${item.title}” has been received.`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      logAudit(user.name, 'claim.submitted', item.title, 'Ownership questions answered')
      toast('Claim submitted for review')
      return true
    },
    [user, items, claims, logAudit, toast],
  )

  const updateClaimStatus: AppState['updateClaimStatus'] = useCallback(
    (claimId, status, note) => {
      const claim = claims.find((candidate) => candidate.id === claimId)
      const item = items.find((candidate) => candidate.id === claim?.itemId)
      const allowedStatus = status === 'under_review' || status === 'approved' || status === 'rejected'
      if (user?.role !== 'admin' || !claim || !item || item.status === 'returned' ||
        !allowedStatus || (claim.status !== 'pending' && claim.status !== 'under_review') ||
        claim.status === status ||
        (status === 'approved' && claims.some((other) => other.itemId === item.id && other.id !== claimId && other.status === 'approved'))) {
        toast('This claim cannot be updated', 'error')
        return false
      }
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? { ...c, status, updatedAt: new Date().toISOString(), adminNote: note ?? c.adminNote }
            : c,
        ),
      )
      if (claim) {
        setNotifications((prev) => [
          {
            id: uid('n'),
            userId: claim.claimantId,
            title: status === 'approved' ? 'Claim approved' : status === 'rejected' ? 'Claim declined' : 'Claim in review',
            message:
              status === 'approved'
                ? `Your claim for “${claim.itemTitle}” was approved. Arrange a verified handoff.`
                : status === 'rejected'
                  ? `Your claim for “${claim.itemTitle}” was not approved.`
                  : `Your claim for “${claim.itemTitle}” is under review.`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ])
        logAudit(user?.name ?? 'Admin', `claim.${status}`, claim.itemTitle, note)
        if (status === 'approved') {
          setItems((prev) =>
            prev.map((i) =>
              i.id === claim.itemId
                ? {
                    ...i,
                    status: 'claim_under_review',
                    timeline: i.timeline.map((t, idx) =>
                      idx === 2 ? { ...t, label: 'Claim approved', description: 'Arrange verified handoff', done: true } : t,
                    ),
                  }
                : i,
            ),
          )
        }
        if (status === 'rejected') {
          const otherOpenClaims = claims.some(
            (c) =>
              c.itemId === claim.itemId &&
              c.id !== claim.id &&
              (c.status === 'pending' || c.status === 'under_review' || c.status === 'approved'),
          )
          if (!otherOpenClaims) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === claim.itemId && (i.status === 'claim_pending' || i.status === 'claim_under_review')
                  ? {
                      ...i,
                      status: 'unclaimed',
                      timeline: i.timeline.map((t, idx) =>
                        idx === 2
                          ? { ...t, label: 'Awaiting claim', description: 'No open claims', done: false }
                          : t,
                      ),
                    }
                  : i,
              ),
            )
          }
        }
      }
      toast(
        status === 'approved' ? 'Claim approved' : status === 'rejected' ? 'Claim declined' : 'Claim moved to review',
      )
      return true
    },
    [claims, items, user, logAudit, toast],
  )

  const markReturned: AppState['markReturned'] = useCallback(
    (itemId, claimId, note) => {
      const item = items.find((candidate) => candidate.id === itemId)
      const claim = claims.find((candidate) => candidate.id === claimId && candidate.itemId === itemId)
      const handoffNote = note.trim()
      if (user?.role !== 'admin' || !item || item.type !== 'found' ||
        item.status !== 'claim_under_review' || claim?.status !== 'approved' || handoffNote.length < 5) {
        toast('An approved claim and handoff note are required', 'error')
        return false
      }
      const now = new Date().toISOString()
      const otherClaims = claims.filter((candidate) => candidate.itemId === itemId && candidate.id !== claimId &&
        (candidate.status === 'pending' || candidate.status === 'under_review'))
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: 'returned',
                timeline: i.timeline.map((t, idx) =>
                  idx === i.timeline.length - 1
                    ? { ...t, done: true, date: now, description: 'Returned to verified claimant' }
                    : t,
                ),
              }
            : i,
        ),
      )
      setClaims((prev) => prev.map((candidate) =>
        otherClaims.some((other) => other.id === candidate.id)
          ? { ...candidate, status: 'rejected', updatedAt: now, adminNote: 'Item returned to another verified claimant' }
          : candidate,
      ))
      setNotifications((prev) => [
        {
          id: uid('n'), userId: claim.claimantId, title: 'Item returned',
          message: `The handoff for “${item.title}” was recorded.`, read: false, createdAt: now,
        },
        ...otherClaims.map((other) => ({
          id: uid('n'), userId: other.claimantId, title: 'Claim closed',
          message: `“${item.title}” was returned to another verified claimant.`, read: false, createdAt: now,
        })),
        ...prev,
      ])
      logAudit(user.name, 'handoff.confirmed', item.title, `Claimant: ${claim.claimantName}. ${handoffNote}`)
      toast('Handoff recorded — item returned')
      return true
    },
    [items, claims, user, logAudit, toast],
  )

  const markAllNotificationsRead = useCallback(() => {
    const uidNow = user?.id
    if (!uidNow) return
    setNotifications((prev) => prev.map((n) => (n.userId === uidNow ? { ...n, read: true } : n)))
  }, [user])

  const itemsByOwner = useCallback((ownerId: string) => items.filter((i) => i.ownerId === ownerId), [items])
  const claimsByUser = useCallback((userId: string) => claims.filter((c) => c.claimantId === userId), [claims])
  const notificationsFor = useCallback(
    (userId: string) => notifications.filter((n) => n.userId === userId),
    [notifications],
  )

  const value = useMemo<AppState>(
    () => ({
      user,
      items,
      claims,
      notifications,
      audit,
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
      user, items, claims, notifications, audit, toasts, signIn, signOut, addItem, submitClaim,
      updateClaimStatus, markReturned, markAllNotificationsRead, toast, dismissToast,
      itemsByOwner, claimsByUser, notificationsFor,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
