export type ListingType = 'lost' | 'found'

export type ItemStatus =
  | 'unclaimed'
  | 'claim_pending'
  | 'claim_under_review'
  | 'returned'
  | 'active'

export type ClaimStatus = 'pending' | 'under_review' | 'approved' | 'rejected'

export interface Item {
  id: string
  type: ListingType
  title: string
  category: string
  description: string
  location: string
  date: string
  status: ItemStatus
  images: string[]
  ownerId: string
  ownerName: string
  /** Private identifying details — only visible to owner + admins, never public */
  privateDetails?: string
  createdAt: string
  timeline: TimelineEvent[]
}

export interface TimelineEvent {
  id: string
  label: string
  description: string
  date: string
  done: boolean
}

export interface OwnershipQuestion {
  id: string
  question: string
  answer: string
}

export interface Claim {
  id: string
  itemId: string
  itemTitle: string
  claimantId: string
  claimantName: string
  statement: string
  questions: OwnershipQuestion[]
  status: ClaimStatus
  createdAt: string
  updatedAt: string
  adminNote?: string
  contactEmail: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export interface AuditEntry {
  id: string
  actor: string
  action: string
  target: string
  timestamp: string
  detail?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

export interface PossibleMatch {
  itemId: string
  similarity: number
  descriptionScore: number
  categoryScore: number
  dateLocationScore: number
}

export const CATEGORIES = [
  'Wallets & Cards',
  'Electronics',
  'Keys',
  'Bags',
  'Water Bottles',
  'Laptops & Sleeves',
  'Clothing & Accessories',
  'Cameras',
  'Other',
] as const

export const LOCATIONS = [
  'University Library',
  'Main Campus Cafe',
  'Student Union',
  'North Parking Garage',
  'City Bus Terminal',
  'Central Park Pavilion',
  'Riverside Gym',
  'Tech Hub Building',
] as const
