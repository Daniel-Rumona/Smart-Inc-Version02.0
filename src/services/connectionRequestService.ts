import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import { isPlatformAdmin, isPlatformOwnerStaff, PLATFORM_OWNER_CODE } from '@/services/companiesService'
import type { FullIdentity } from '@/types/identity'
import type {
  ConnectionRequest,
  ConnectionRequestDeliveryMode,
  ConnectionRequestStatus,
  ConnectionRequestTargetType,
  ConnectionRequestUrgency,
} from '@/types/connectionRequest'

const REVIEW_ROLES = new Set(['systemadmin', 'admin', 'director', 'projectadmin', 'projectmanager', 'operations'])

/**
 * Marketplace requests come from SMEs in the platform owner's fallback bucket, so only that
 * workspace's operations staff (plus platform admins) review them - not every company's operations.
 */
const canReviewConnectionRequests = (user?: FullIdentity | null) =>
  Boolean(user && REVIEW_ROLES.has(user.role) && isPlatformOwnerStaff(user))

const DELIVERY_MODES: ConnectionRequestDeliveryMode[] = ['online', 'in_person', 'hybrid', 'no_preference']
const URGENCIES: ConnectionRequestUrgency[] = ['low', 'normal', 'high']

export type CreateConnectionRequestInput = {
  smeUid: string
  smeName: string
  smeEmail: string
  targetType: ConnectionRequestTargetType
  targetId: string
  targetName: string
  companyCode?: string
  areaOfSupport?: string
  deliveryMode?: ConnectionRequestDeliveryMode
  preferredStartDate?: string
  engagementDays?: number
  urgency?: ConnectionRequestUrgency
  budget?: number
  currency?: string
  note?: string
}

const mapConnectionRequest = (id: string, data: Record<string, unknown>): ConnectionRequest => ({
  id,
  smeUid: String(data.smeUid || ''),
  smeName: String(data.smeName || ''),
  smeEmail: String(data.smeEmail || ''),
  targetType: data.targetType === 'agent' ? 'agent' : 'consultant',
  targetId: String(data.targetId || ''),
  targetName: String(data.targetName || ''),
  // Requests written before the marketplace was scoped carry no code; they were all platform-owner SMEs.
  companyCode: String(data.companyCode || '').trim() || PLATFORM_OWNER_CODE,
  areaOfSupport: typeof data.areaOfSupport === 'string' ? data.areaOfSupport : undefined,
  deliveryMode: DELIVERY_MODES.includes(data.deliveryMode as ConnectionRequestDeliveryMode) ? data.deliveryMode as ConnectionRequestDeliveryMode : undefined,
  preferredStartDate: typeof data.preferredStartDate === 'string' ? data.preferredStartDate : undefined,
  engagementDays: typeof data.engagementDays === 'number' ? data.engagementDays : undefined,
  urgency: URGENCIES.includes(data.urgency as ConnectionRequestUrgency) ? data.urgency as ConnectionRequestUrgency : undefined,
  budget: typeof data.budget === 'number' ? data.budget : undefined,
  currency: typeof data.currency === 'string' ? data.currency : undefined,
  note: typeof data.note === 'string' ? data.note : undefined,
  status: ['pending', 'contacted', 'matched', 'declined'].includes(data.status as string) ? data.status as ConnectionRequestStatus : 'pending',
  reviewerNote: typeof data.reviewerNote === 'string' ? data.reviewerNote : undefined,
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
})

export const createConnectionRequest = async (input: CreateConnectionRequestInput) => {
  await addDoc(collection(getFirebaseDb(), 'connectionRequests'), {
    smeUid: input.smeUid,
    smeName: input.smeName,
    smeEmail: input.smeEmail,
    targetType: input.targetType,
    targetId: input.targetId,
    targetName: input.targetName,
    companyCode: input.companyCode?.trim() || PLATFORM_OWNER_CODE,
    areaOfSupport: input.areaOfSupport?.trim() || null,
    deliveryMode: input.deliveryMode ?? null,
    preferredStartDate: input.preferredStartDate ?? null,
    engagementDays: input.engagementDays ?? null,
    urgency: input.urgency ?? 'normal',
    budget: input.budget ?? null,
    currency: input.currency || 'ZAR',
    note: input.note?.trim() || null,
    status: 'pending' satisfies ConnectionRequestStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const listConnectionRequests = async (user?: FullIdentity | null): Promise<ConnectionRequest[]> => {
  if (!canReviewConnectionRequests(user)) throw new Error('forbidden')

  const snapshot = await getDocs(query(collection(getFirebaseDb(), 'connectionRequests'), orderBy('createdAt', 'desc')))
  const rows = snapshot.docs.map((row) => mapConnectionRequest(row.id, row.data()))
  if (isPlatformAdmin(user)) return rows

  // Filtered in memory rather than by query, so legacy requests with no companyCode
  // still surface in the platform owner's queue via the mapper's fallback.
  const reviewerCompanyCode = String(user?.companyCode || '').trim()
  return rows.filter((row) => row.companyCode === reviewerCompanyCode)
}

/** The SME's own requests, so they can track what they asked for without operations access. */
export const listConnectionRequestsForSme = async (smeUid: string): Promise<ConnectionRequest[]> => {
  if (!smeUid) return []

  const snapshot = await getDocs(query(collection(getFirebaseDb(), 'connectionRequests'), where('smeUid', '==', smeUid)))
  const rows = snapshot.docs.map((row) => mapConnectionRequest(row.id, row.data()))
  const toMillis = (value: unknown) => (value as { toMillis?: () => number })?.toMillis?.() ?? 0
  return rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

export const updateConnectionRequestStatus = async (
  id: string,
  status: ConnectionRequestStatus,
  reviewerNote: string | undefined,
  user?: FullIdentity | null,
) => {
  if (!canReviewConnectionRequests(user)) throw new Error('forbidden')

  await updateDoc(doc(getFirebaseDb(), 'connectionRequests', id), {
    status,
    reviewerNote: reviewerNote?.trim() || null,
    updatedAt: serverTimestamp(),
  })
}
